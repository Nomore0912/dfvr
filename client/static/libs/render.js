// initVR
import * as THREE from '../js/three.module.js';
import {VRButton} from '../js/webxr/VRButton.js';
import {OrbitControls} from '../js/controls/OrbitControls.js';
import {OculusHandModel} from '../js/webxr/OculusHandModel.js';
import {XRControllerModelFactory} from '../js/webxr/XRControllerModelFactory.js';
import {df} from './core.js';
import {onTriggerDown, onTriggerUp} from './gamepad.js';
import {OculusHandPointerModel} from "../js/webxr/OculusHandPointerModel.js";

var container;
var camera, scene, renderer, rayCaster;
var canon = new THREE.Object3D();
var lightType = 0;
// initVR -- controls
var controls, leftController, leftControllerGrip, rightController, rightControllerGrip, leftHand, rightHand;
var leftSqueezeStart = false;
var rightSqueezeStart = false;
var ScoreTemp = 0

function ScalePDB() {
    if (df.SelectedPDBId) {
        if (leftSqueezeStart) {
            for (let chain in df.GROUP[df.SelectedPDBId]['main']) {
                let group = df.GROUP[df.SelectedPDBId]['main'][chain]
                group.scale.multiplyScalar(1.01);
            }
        }
        if (rightSqueezeStart) {
            for (let chain in df.GROUP[df.SelectedPDBId]['main']) {
                let group = df.GROUP[df.SelectedPDBId]['main'][chain]
                group.scale.multiplyScalar(0.99);
            }
        }
    }
}

df.render = {
    vrScene: function () {
        let newScene = new THREE.Scene();
        // 背景: 深蓝色
        newScene.background = new THREE.Color(0x17202A);
        // 创建一个半球光源 HemisphereLight(skyColor, groundColor)
        let hemisphereLight = new THREE.HemisphereLight(0x74B9FF, 0x2C3E50);
        newScene.add(hemisphereLight);
        return newScene;
    },
    vrCamera: function () {
        // 创建透视相机，参数分别是：视场角，宽高比，近剪裁面距离，远剪裁面距离
        let newCamera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 50000);
        // 设置相机初始位置
        newCamera.position.set(0, 1.6, 300);
        return newCamera;
    },
    nonVrControls: function (cameras, divs) {
        return new OrbitControls(cameras, divs);
    },
    addLightsByType: function (lightType) {
        if (lightType === 0) {
            let light = new THREE.DirectionalLight(0xF8D5A3, 1.2);
            light.position.copy(camera.position);
            camera.add(light);
        }
    },
    initSceneGroup: function () {
        // df.GROUP.init
        for (let idx in df.GROUP_INDEX) {
            let gName = df.GROUP_INDEX[idx];
            df.GROUP[gName] = new THREE.Group();
            df.GROUP[gName].name = gName;
            switch (gName) {
                case "menu":
                    camera.add(df.GROUP[gName]);
                    break;
                case "score":
                    camera.add(df.GROUP[gName]);
                    break;
                default:
                    scene.add(df.GROUP[gName]);
                    break
            }
        }
    },
    initRender: function () {
        let renderer = new THREE.WebGLRenderer({
            antialias: true,
            gammaOutput: true
        });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;
        container.appendChild(renderer.domElement);
        renderer.xr.enabled = true;
        return renderer;
    },
    createController: function (renderer, camera, num) {
        let controller = renderer.xr.getController(num);
        camera.add(controller);
        return controller;
    },
    createControllerGrip: function (renderer, camera, modelFactory, num) {
        let controllerGrip = renderer.xr.getControllerGrip(num);
        controllerGrip.add(modelFactory.createControllerModel(controllerGrip));
        camera.add(controllerGrip);
        return controllerGrip;
    },
    createControllerLine: function () {
        let geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, -1], 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute([0.5, 0.5, 0.5, 0, 0, 0], 3));
        let material = new THREE.LineBasicMaterial({
            vertexColors: true,
            linewidth: 100,
            blending: THREE.AdditiveBlending
        });
        let line = new THREE.Line(geometry, material);
        line.name = 'line';
        line.scale.z = 5;
        line.visible = true;
        return line;
    },
    createHandController: function (renderer, camera, num) {
        let hand = renderer.xr.getHand(num);
        let handModel = new OculusHandModel(hand);

        hand.add(handModel);
        camera.add(hand);
        return hand;
    },
    initVR: function () {
        // 创建一个模块
        container = document.createElement('div');
        document.body.appendChild(container);
        // Scene
        scene = this.vrScene();
        // Camera
        camera = this.vrCamera();
        // 移动 Camera
        canon.add(camera);
        scene.add(canon);
        // 在 web 页面中旋转移动 pdb
        controls = this.nonVrControls(camera, container);
        controls.target.set(0, 1.6, 0);
        controls.update();
        // 初始化 scene group;
        this.initSceneGroup();
        this.addLightsByType(lightType);
        // init VR render
        renderer = this.initRender();

        const sessionInit = {
            requiredFeatures: ['hand-tracking']
        };

        document.body.appendChild(VRButton.createButton(renderer, sessionInit));
        // 监听 vr
        let isImmersive = false;
        renderer.xr.addEventListener('sessionstart', () => {
            df.tool.initPDBView(df.SelectedPDBId);
            isImmersive = true;
        });
        renderer.xr.addEventListener('sessionend', () => {
            isImmersive = false;
        });

        // xr
        leftController = this.createController(renderer, canon, 1);
        rightController = this.createController(renderer, canon, 0);
        rayCaster = new THREE.Raycaster();

        // Hand
        leftHand = this.createHandController(renderer, canon, 1);
        rightHand = this.createHandController(renderer, canon, 0);

        let controllerModelFactory = new XRControllerModelFactory();
        leftControllerGrip = this.createControllerGrip(renderer, canon, controllerModelFactory, 1);
        rightControllerGrip = this.createControllerGrip(renderer, canon, controllerModelFactory, 0);
        const leftControllerPointer = new OculusHandPointerModel(leftHand, leftController);
        const rightControllerPointer = new OculusHandPointerModel(rightHand, rightController);
        leftHand.add(leftControllerPointer);
        rightHand.add(rightControllerPointer);
        // 射线
        let leftLine = this.createControllerLine();
        let rightLine = this.createControllerLine();
        leftController.add(leftLine);
        rightController.add(rightLine);

        leftController.addEventListener('selectstart', function (event) {
            let leftTempMatrix = new THREE.Matrix4();
            onTriggerDown(event, rayCaster, leftTempMatrix);
        });
        // 放大 缩小
        leftController.addEventListener('squeezestart', function (event) {
            leftSqueezeStart = true;
        });
        leftController.addEventListener('squeezeend', function (event) {
            leftSqueezeStart = false;
        });
        rightController.addEventListener('squeezestart', function (event) {
            if (!leftSqueezeStart) {
                rightSqueezeStart = true;
            }
        });
        rightController.addEventListener('squeezeend', function (event) {
            rightSqueezeStart = false;
        });

        rightController.addEventListener('selectstart', function (event) {
            let rightTempMatrix = new THREE.Matrix4();
            onTriggerDown(event, rayCaster, rightTempMatrix)
        });
        leftController.addEventListener('selectend', function (event) {
            onTriggerUp(event);
        });
        rightController.addEventListener('selectend', function (event) {
            onTriggerUp(event);
        });
        window.addEventListener('resize', onWindowResize, false);


        // camera.updateProjectionMatrix();
        function animate() {
            df.render.score("7fjc");
            ScalePDB();
            camera.updateProjectionMatrix();
            renderer.render(scene, camera);
        }

        controls.update();
        renderer.setAnimationLoop(animate);

        function onWindowResize() {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        }
    },
    score: function (pdbId) {

        if (df.SelectedPDBId === pdbId) {
            if (df.GROUP[pdbId] && df.GROUP[pdbId]['main']) {
                let score = df.tool.similarScore(pdbId);
                        console.log(1)
                if (ScoreTemp !== score) {
                    let score_str = "得分: " + score.toString() + "分！"
                    df.drawer.updateText(score_str, df.GROUP["score"].children[0]);
                    ScoreTemp = score
                }
            }
        }
    },
    // todo
    clean: function (mode, pdbId) {
        THREE.Cache.clear();
        // df.GROUP[df.SelectedPDBId] = {}
        switch (mode) {
            case 0:
                for (let modeKey in df.GROUP[pdbId]) {
                    df.tool.clearGroupIndex(df.GROUP[pdbId][modeKey]);
                }
                break;
            case 1:
                df.tool.clearGroupIndex(df.GROUP_HET);
                break;
        }
    },
}


window.df = df;

export {
    container,
    camera,
    scene,
    renderer,
    rayCaster,
    canon,
    controls,
    leftController,
    leftControllerGrip,
    rightController,
    rightControllerGrip,
    leftHand,
    rightHand
}

