let canvas, textbox, gl, shader, batcher, assetManager, skeletonRenderer;
let mvp = new spine.Matrix4();

let lastFrameTime;
let spineData;

let customScale = 1;
let targetFps = 60;
let bgmfile = './assets/audio/Theme_268.ogg';
let bgmvolume = 0;
let bgm;
let bufferColor = [0.3, 0.3, 0.3];

let introAnimation, acceptingClick;
let dialogBox = false;
let currentVoiceline = 1;
let mouseSelect = -1;
let trackerID = -1;
let untrackerID = -1;
let unpetID = -1;
let isHeadpatActive = false;
let PPointX, PPointY, EPointX, EPointY;
let TPoint, TEye;
let flipped = false;

let transpose = 1;

let currentTracks = []; // 跟踪当前播放的音频
window.selectedLanguage = 'Japanese'; // 全局语言变量（挂载到window对象）

const CHARACTER = 'CH0304';
let modelResolution = '8k';
const BINARY_PATH = window.location.protocol === 'file:' ? location.href.replace('/index.html', `/assets/${modelResolution}/${CHARACTER}_home.skel`) : `../assets/${modelResolution}/${CHARACTER}_home.skel`;
const ATLAS_PATH = window.location.protocol === 'file:' ? location.href.replace('/index.html', `/assets/${modelResolution}/${CHARACTER}_home.atlas`) : `../assets/${modelResolution}/${CHARACTER}_home.atlas`;
const HAS_A = { eye: false, point: true };

// All voicelines are manually timed for start point and duration. This may not be the most optimized solution, but works for all intents and purposes.

const AUDIO_DETAIL = [
	{
		time: 18000,
		count: 2,
		startTimes: [5700, 10200],
		dialog: {
			Japanese: [
				"……はじめて絵を描いた日を、思い出します。",
				"あのときは……まっすぐ、純粋に、キャンバスと向き合っていました。"
			],
			English: [
				"...I remember the day I first picked up a brush.",
				"Back then... I faced the canvas with innocence and purity."
			],
			Chinese: [
				"……想起了第一次拿起笔作画的那天。",
				"那时的我……纯粹而专注，只是单纯地，心无旁骛地面对着画布。"
			]
		}
	},
	{
		time: 14000,
		count: 2,
		startTimes: [500, 5700],
		dialog: {
			Japanese: [
				"今の私は……違います。",
				"何を描けばいいのか分からなくなって、自信を失ってしまって……。"
			],
			English: [
				"But now... I've changed.",
				"I've lost my way, not knowing what to paint anymore..."
			],
			Chinese: [
				"现在的我……却不同了。",
				"迷失了该画什么，也失去了自信……"
			]
		}
	},
	{
		time: 14000,
		count: 2,
		startTimes: [500, 6100],
		dialog: {
			Japanese: [
				"そんなとき、マスターが教えてくれたんです。",
				"「夢」という魔法は、もう心の中に宿ってるって。"
			],
			English: [
				"That's when Master taught me something important.",
				"The magic called 'dreams' already resides within your heart."
			],
			Chinese: [
				"就在那时，Master告诉了我。",
				"名为『梦想』的魔法，早已寄宿在心中。"
			]
		}
	},
	{
		time: 23000,
		count: 2,
		startTimes: [1000, 9300],
		dialog: {
			Japanese: [
				"夢があるなら……これからは、道に迷わずに済みそうです。",
				"マスター……よければ、私と同じ道を歩みませんか？"
			],
			English: [
				"With dreams... I won't lose my way anymore.",
				"Master... would you walk this path with me, if you will?"
			],
			Chinese: [
				"只要怀揣梦想……从今以后，应该不会再迷失方向了。",
				"Master……如果您愿意的话，可以陪我一起走下去吗？"
			]
		}
	},
	{
		time: 11000,
		count: 1,
		startTimes: [500],
		dialog: {
			Japanese: [
				"色とりどりの夢でいっぱいの、魔法の道を！"
			],
			English: [
				"A magical path filled with colorful dreams!"
			],
			Chinese: [
				"这条魔法之路，会缀满五彩斑斓的梦想！"
			]
		}
	}
];


const HITBOX = {
	headpat: { xMin: 1760, xMax: 2200, yMin: 100, yMax: 450 },
	voiceline: { xMin: 960, xMax: 1500, yMin: 600, yMax: 1600 }
};

const INTRO_TIMEOUT = 19500;
const HEADPAT_CLAMP = 30;
const EYE_CLAMP_X = 200;
const EYE_CLAMP_Y = EYE_CLAMP_X * (9 / 16);
const HEADPAT_STEP = 5;
const EYE_STEP = 10;

let mousePos = { x: 0, y: 0 };
let volume = 0.5;
let mouseOptions = { voicelines: true, headpatting: true, mousetracking: true, drawHitboxes: false };

// Helper clamp function. Math does not appear to have clamp() in this version.
function clamp(num, min, max) {
	return Math.min(Math.max(num, min), max);
}

// NOTE: X and Y appears to be inversely related from cursor position to bone adjustment.
//       This behavior's reason is unknown, but it LOOKS right so leave it alone!
function trackMouse() {
	let adjX = (mousePos.x / canvas.width) - 0.5;
	let adjY = (mousePos.y / canvas.height) - 0.5;
	TEye.y = TEye.y - (Math.sign(adjX) * EYE_STEP);
	TEye.x = TEye.x - (Math.sign(adjY) * EYE_STEP);
	TEye.y = clamp(TEye.y, EPointY - (Math.abs(adjX) * EYE_CLAMP_X), EPointY + (Math.abs(adjX) * EYE_CLAMP_X));
	TEye.x = clamp(TEye.x, EPointX - (Math.abs(adjY) * EYE_CLAMP_Y), EPointX + (Math.abs(adjY) * EYE_CLAMP_Y));
}

function untrackMouse() {
	if (Math.abs(TEye.y - EPointY) <= EYE_STEP && Math.abs(TEye.x - EPointX) <= EYE_STEP) {
		if (untrackerID != -1) {
			TEye.y = EPointY;
			TEye.x = EPointX;
			clearInterval(untrackerID);
			untrackerID = -1;
			setTimeout(function () {
				acceptingClick = true;
			}, 500);
		}
	}
	if (TEye.y > EPointY) TEye.y -= EYE_STEP;
	if (TEye.y < EPointY) TEye.y += EYE_STEP;
	if (TEye.x > EPointX) TEye.x -= EYE_STEP;
	if (TEye.x < EPointX) TEye.x += EYE_STEP;
}

function unpet() {
	if (Math.abs(TPoint.x - PPointX) <= HEADPAT_STEP && Math.abs(TPoint.y - PPointY) <= HEADPAT_STEP) {
		if (unpetID != -1) {
			TPoint.x = PPointX;
			TPoint.y = PPointY;
			clearInterval(unpetID);
			unpetID = -1;
			setTimeout(function () {
				acceptingClick = true;
			}, 500);
		}
	}
	if (TPoint.y > PPointY) TPoint.y -= HEADPAT_STEP;
	if (TPoint.y < PPointY) TPoint.y += HEADPAT_STEP;
	if (TPoint.x > PPointX) TPoint.x -= HEADPAT_STEP;
	if (TPoint.x < PPointX) TPoint.x += HEADPAT_STEP;
}

function playVoiceline() {
	spineData.state.setEmptyAnimation(1, 1);
	spineData.state.setEmptyAnimation(2, 1);
	spineData.state.addAnimation(1, `Talk_0${currentVoiceline}_M`, false, 0);
	spineData.state.addAnimation(2, `Talk_0${currentVoiceline}_A`, false, 0);
	spineData.state.addEmptyAnimation(1, 0.5, 0);
	spineData.state.addEmptyAnimation(2, 0.5, 0);

	let trackDetails = AUDIO_DETAIL[currentVoiceline - 1];

	const timeout1 = setTimeout(function () {
		acceptingClick = true;
		// 当达到末尾时循环回到第一句
		if (currentVoiceline >= AUDIO_DETAIL.length) {
			currentVoiceline = 1;
		} else {
			currentVoiceline = currentVoiceline + 1;
		}
	}, trackDetails.time);
	voicelineTimeouts.push(timeout1);

	for (let i = 0; i < trackDetails.count; i++) {
		let track;
		if (trackDetails.count == 1) track = new Audio(`./assets/audio/${CHARACTER}_memoriallobby_${currentVoiceline}.ogg`);
		else track = new Audio(`./assets/audio/${CHARACTER}_memoriallobby_${currentVoiceline}_${(i + 1)}.ogg`);
		track.volume = volume;
		const timeout2 = setTimeout(function () {
			track.play();
			currentTracks.push({ track, index: i }); // 记录当前播放的音频
			if (dialogBox) {
				const selectedLanguage = window.selectedLanguage || 'Japanese'; // 使用全局语言变量
				textbox.innerHTML = trackDetails.dialog[selectedLanguage][i];
				if (dialogBox) textbox.style.opacity = 1; // 确保仅当显示对话框时生效
				track.addEventListener('ended', function () {
					currentTracks = currentTracks.filter(t => t.track !== track); // 移除结束的音频
					textbox.style.opacity = 0;
				});
			}
		}, trackDetails.startTimes[i]);
		voicelineTimeouts.push(timeout2);
	}
}

// Hitbox Scaling
function t(n, side) {
	let d = { x: { length: 2560, mid: (canvas.width / 2) }, y: { length: 1600, mid: (canvas.height / 2) } }
	n = d[side].mid - n;
	n = (d[side].length / (transpose * 2)) - n;
	n = (n - (d[side].length / (transpose * 2))) / customScale;
	return (n + (d[side].length / (transpose * 2))) * transpose;
}

// -1 = [No Entry], 1 = Headpat, 2 = Voiceline, 3 = Eye Track
function pressedMouse(x, y) {
	tx = t(x, 'x');
	ty = t(y, 'y');
	if (tx > HITBOX.headpat.xMin && tx < HITBOX.headpat.xMax && ty > HITBOX.headpat.yMin && ty < HITBOX.headpat.yMax && mouseOptions.headpatting) {
		spineData.state.clearTrack(1);
		spineData.state.setAnimation(1, 'Pat_01_M', false);
		mouseSelect = 1;
		isHeadpatActive = true;
	}
	else if (tx > HITBOX.voiceline.xMin && tx < HITBOX.voiceline.xMax && ty > HITBOX.voiceline.yMin && ty < HITBOX.voiceline.yMax && mouseOptions.voicelines) {
		mouseSelect = 2;
	}
	else if (mouseOptions.mousetracking) {
		if (trackerID == -1) {
			trackerID = setInterval(trackMouse, 20);
		}
		spineData.state.setEmptyAnimation(1, 0);
		spineData.state.setEmptyAnimation(2, 0);
		let eyetracking = spineData.state.addAnimation(1, 'Look_01_M', false, 0);
		eyetracking.mixDuration = 0.2;
		if (HAS_A.eye) {
			let eyetracking2 = spineData.state.addAnimation(2, 'Look_01_A', false, 0);
			eyetracking2.mixDuration = 0.2;
		}
		mousePos.x = x;
		mousePos.y = y;
		mouseSelect = 3;
	}
	else if (mouseSelect == -1) {
		acceptingClick = true;
	}
}

function drawHitboxes() {
	if (!overlay || !overlay.getContext) return;
	const ctx = overlay.getContext('2d');
	if (!ctx) return;

	ctx.clearRect(0, 0, overlay.width, overlay.height);
	if (!mouseOptions.drawHitboxes) return;

	
	ctx.save();
	ctx.lineWidth = 2;
	ctx.strokeStyle = 'red';
	ctx.globalAlpha = 0.5;

	function worldToScreen(n, side) {
		let d = { x: { length: 2560, mid: (canvas.width / 2) }, y: { length: 1600, mid: (canvas.height / 2) } };
		n = (n / transpose) - (d[side].length / (transpose * 2));
		n = n * customScale + (d[side].length / (transpose * 2));
		n = (d[side].length / (transpose * 2)) - n;
		return d[side].mid - n;
	}

	for (const key in HITBOX) {
		const box = HITBOX[key];
		const x1 = worldToScreen(box.xMin, 'x');
		const y1 = worldToScreen(box.yMin, 'y');
		const x2 = worldToScreen(box.xMax, 'x');
		const y2 = worldToScreen(box.yMax, 'y');
		const width = x2 - x1;
		const height = y1 - y2;
		ctx.strokeRect(x1, y2, width, height);
	}

	ctx.restore();
}

function movedMouse(x, y, deltaX, deltaY) {
	switch (mouseSelect) {
		case 1:
			// Motion: Clockwise
			// if ((y < 800 && deltaY < 0) || (x >= 1440 && deltaX > 0)) {
			// 	TPoint.y = clamp(TPoint.y - HEADPAT_STEP, PPointY - HEADPAT_CLAMP, PPointY + HEADPAT_CLAMP);
			// }
			// else if ((y >= 800 && deltaY > 0) || (x < 1440 && deltaX < 0)) {
			// 	TPoint.y = clamp(TPoint.y + HEADPAT_STEP, PPointY - HEADPAT_CLAMP, PPointY + HEADPAT_CLAMP);
			// }
			// break;
		case 2:
			mouseSelect = -1;
			acceptingClick = true;
			break;
		case 3:
			mousePos.x = x;
			mousePos.y = y;
			break;
		default:
	}
}

function releasedMouse() {
	if (isHeadpatActive) {
		if (unpetID == -1) {
			unpetID = setInterval(unpet, 20);
		}
		// 清理动画队列并设置结束动画
		spineData.state.clearTrack(1);
		spineData.state.setAnimation(1, 'PatEnd_01_M', false);
		spineData.state.addEmptyAnimation(1, 0.5, 0);
		isHeadpatActive = false;
	}
	switch (mouseSelect) {
		case 1:
			break;
		case 2:
			playVoiceline();
			break;
		case 3:
			if (trackerID != -1) {
				clearInterval(trackerID);
				trackerID = -1;
			}
			if (untrackerID == -1) {
				untrackerID = setInterval(untrackMouse, 20);
			}
			spineData.state.clearTrack(1);
			let eyetracking = spineData.state.setAnimation(1, 'LookEnd_01_M', false);
			eyetracking.mixDuration = 0;
			spineData.state.addEmptyAnimation(1, 0.5, 0);
			break;
		default:
	}
	mouseSelect = -1;
}

// adjusts mouse values for flipped canvas
function setMouse(event) {
	let ax = event.clientX;
	let ay = event.clientY;
	let mx = 1;
	if (flipped) {
		mx = -1;
		ax = canvas.width - ax;
	}

	return { x: ax, y: ay, m: mx }
}

function init() {
	// Wallpaper Engine settings
	window.wallpaperPropertyListener = {
		applyUserProperties: (props) => {
			if (props.schemecolor) {
				bufferColor = props.schemecolor.value.split(" ");
			}
			if (props.alignmentfliph) flipped = props.alignmentfliph.value;
			if (props.scale) {
				customScale = props.scale.value;
				resize();
			}
			if (props.targetfps) targetFps = props.targetfps.value;

			if (props.introanimation) introAnimation = props.introanimation.value;

			if (props.mousetracking) mouseOptions.mousetracking = props.mousetracking.value;
			if (props.headpatting) mouseOptions.headpatting = props.headpatting.value;
			if (props.voicelines) mouseOptions.voicelines = props.voicelines.value;
			if (props.voicevolume) volume = props.voicevolume.value / 100;
			if (props.showdialog) dialogBox = props.showdialog.value;
			if (props.dialogx) textbox.style.left = props.dialogx.value + '%';
			if (props.dialogy) textbox.style.top = props.dialogy.value + '%';
			if (props.drawHitboxes) mouseOptions.drawHitboxes = props.drawHitboxes.value;

			// 监听模型分辨率设置
			if (props.modelresolution) {
				modelResolution = props.modelresolution.value;
				// 重新加载模型
				reloadModel();
			}

			// 新增：监听语言选择
			if (props.dialoglanguage) {
				window.selectedLanguage = props.dialoglanguage.value; // 更新全局语言变量
				// 更新当前播放的音频文本
				currentTracks.forEach(({ track, index }) => {
					const trackDetails = AUDIO_DETAIL[currentVoiceline - 1];
					if (dialogBox && trackDetails.dialog[window.selectedLanguage]) {
						textbox.innerHTML = trackDetails.dialog[window.selectedLanguage][index];
					}
				})
			}

			if (props.bgmfile) {
				bgmfile = 'file:///' + props.bgmfile.value.replace("%3A", "\:");
			}
			if (props.bgmvolume) {
				bgmvolume = props.bgmvolume.value / 100;
				if (bgm) bgm.volume = bgmvolume;
			}
		},
		setPaused: function(isPaused) {
				if (bgm) {
					if (isPaused) {
						setTimeout(() => { bgm.volume = 0; }, 200);
					} else {
						setTimeout(() => { bgm.volume = bgmvolume; }, 200);
					}
				}
			}
	};

	textbox = document.getElementById('textbox');

	canvas = document.getElementById('canvas');
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;

	overlay = document.getElementById('overlay');
	overlay.width = window.innerWidth;
	overlay.height = window.innerHeight;

	let config = { alpha: false, premultipliedAlpha: false, antialias: true };
	gl = canvas.getContext('webgl', config) || canvas.getContext('experimental-webgl', config);
	if (!gl) {
		alert('WebGL is unavailable.');
		return;
	}

	// Create a simple shader, mesh, model-view-projection matrix, SkeletonRenderer, and AssetManager.
	shader = spine.Shader.newTwoColoredTextured(gl);
	batcher = new spine.PolygonBatcher(gl);
	mvp.ortho2d(0, 0, canvas.width - 1, canvas.height - 1);
	skeletonRenderer = new spine.SkeletonRenderer(gl);
	assetManager = new spine.AssetManager(gl);

	// Load assets for use.
	assetManager.loadBinary(BINARY_PATH);
	assetManager.loadTextureAtlas(ATLAS_PATH);

	requestAnimationFrame(load);
}

let introAudioIsPlaying = false;
let introAudioTracks = [];
let introTimeouts = [];
let voicelineTimeouts = [];

// Function to reload the model with a new resolution
function reloadModel() {
	// Stop the current BGM if it's playing
	if (bgm) {
		bgm.pause();
		bgm = null;
	}
	
	// Reset BloomHidden variables to ensure bloom hiding works after resolution change
	BloomHidden = false;
	BloomHidden2 = false;
	BloomHidden3 = false;
	BloomHidden4 = false;
	BloomHidden5 = false;
	
	// Stop all intro audio and clear related timeouts
	introAudioIsPlaying = false;
	
	// Stop and clear all intro audio tracks
	introAudioTracks.forEach(track => {
		if (track && !track.paused) {
			track.pause();
			track.currentTime = 0;
		}
	});
	introAudioTracks = [];
	
	// Stop and clear all voiceline audio tracks
	currentTracks.forEach(({ track }) => {
		if (track && !track.paused) {
			track.pause();
			track.currentTime = 0;
		}
	});
	currentTracks = [];
	
	// Clear all intro timeouts
	introTimeouts.forEach(timeout => clearTimeout(timeout));
	introTimeouts = [];
	
	// Clear all voiceline timeouts
	voicelineTimeouts.forEach(timeout => clearTimeout(timeout));
	voicelineTimeouts = [];
	
	// Hide dialog box
	if (textbox) {
		textbox.style.opacity = 0;
	}
	
	// Generate new paths based on the selected resolution
	const newBinaryPath = window.location.protocol === 'file:' ? location.href.replace('/index.html', `/assets/${modelResolution}/${CHARACTER}_home.skel`) : `../assets/${modelResolution}/${CHARACTER}_home.skel`;
	const newAtlasPath = window.location.protocol === 'file:' ? location.href.replace('/index.html', `/assets/${modelResolution}/${CHARACTER}_home.atlas`) : `../assets/${modelResolution}/${CHARACTER}_home.atlas`;
	
	// Clear the existing assets
	assetManager.removeAll();
	
	// Load new assets
	assetManager.loadBinary(newBinaryPath);
	assetManager.loadTextureAtlas(newAtlasPath);
	
	// Clear the current skeleton data to prevent rendering issues during loading
	spineData = null;
	
	// Restart the loading process
	requestAnimationFrame(load);
}

// CITATION: http://esotericsoftware.com/spine-api-reference#
// CITATION: http://en.esotericsoftware.com/forum/Spine-Unity-Making-the-arm-follow-the-mouse-7856
function interactionLoad() {
	// Touch_Point and Touch_Eye
	TPoint = spineData.skeleton.findBone('Touch_Point');
	TEye = spineData.skeleton.findBone('Touch_Eye');
	PPointX = TPoint.x;
	PPointY = TPoint.y;
	EPointX = TEye.x;
	EPointY = TEye.y;

	downaction = canvas.addEventListener('mousedown', function (event) {
		if (!acceptingClick) {
			return;
		}
		acceptingClick = false;
		let mouseData = setMouse(event);
		pressedMouse(mouseData.x, mouseData.y);
	});
	upaction = canvas.addEventListener('mouseup', function () {
		releasedMouse();
	});
	moveaction = canvas.addEventListener('mousemove', function (event) {
		let mouseData = setMouse(event);
		movedMouse(mouseData.x, mouseData.y, (event.movementX * mouseData.m), event.movementY);
	});

	if (!introAnimation) {
		acceptingClick = true;
	}
	else {
		setTimeout(function () {
			acceptingClick = true;
		}, INTRO_TIMEOUT);
	}

	return 1;
}

function load() {
	// Wait until the AssetManager has loaded all resources, then load the skeletons.
	if (assetManager.isLoadingComplete() && typeof introAnimation !== 'undefined') {
		// 根据当前分辨率动态生成路径
		const dynamicBinaryPath = window.location.protocol === 'file:' ? location.href.replace('/index.html', `/assets/${modelResolution}/${CHARACTER}_home.skel`) : `../assets/${modelResolution}/${CHARACTER}_home.skel`;
		const dynamicAtlasPath = window.location.protocol === 'file:' ? location.href.replace('/index.html', `/assets/${modelResolution}/${CHARACTER}_home.atlas`) : `../assets/${modelResolution}/${CHARACTER}_home.atlas`;
		
		// Check if the assets exist before trying to load them
		if (!assetManager.get(dynamicBinaryPath) || !assetManager.get(dynamicAtlasPath)) {
			console.error('Model assets not found for resolution: ' + modelResolution);
			requestAnimationFrame(load);
			return;
		}
		
		spineData = loadSpineData(dynamicBinaryPath, dynamicAtlasPath, false);

		// User Option to skip Intro Animation
		if (introAnimation) {
			spineData.state.addAnimation(0, 'Start_Idle_01', false);

			if (mouseOptions.voicelines) {
				let track = new Audio(`./assets/audio/${CHARACTER}_memoriallobby_0.ogg`);
				track.volume = volume;
				setTimeout(function () {
					track.play();
				}, 11500);
			}
		}

		spineData.state.addAnimation(0, 'Idle_01', true, 0);

		interactionLoad();
		resize();

		// Plays user-defined BGM (if set)
		if (!bgm) {
			bgm = new Audio(bgmfile);
			bgm.volume = bgmvolume;
			bgm.loop = true;
			bgm.play();
			bgm.addEventListener('ended', function () {
				this.currentTime = 0;
				this.play();
			}, false);
		}

		lastFrameTime = Date.now() / 1000;
		// Call render every frame.
		requestAnimationFrame(render);
	} else {
		requestAnimationFrame(load);
	}
}

function loadSpineData(binaryPath, atlasPath, premultipliedAlpha) {
	// Load the texture atlas from the AssetManager.
	let atlas = assetManager.get(atlasPath);

	// Create a AtlasAttachmentLoader that resolves region, mesh, boundingbox and path attachments
	let atlasLoader = new spine.AtlasAttachmentLoader(atlas);

	// Create a SkeletonBinary instance for parsing the .skel file.
	let skeletonBinary = new spine.SkeletonBinary(atlasLoader);

	// Set the scale to apply during parsing, parse the file, and create a new skeleton.
	skeletonBinary.scale = 1;
	let skeletonData = skeletonBinary.readSkeletonData(assetManager.get(binaryPath));
	let skeleton = new spine.Skeleton(skeletonData);
	let bounds = calculateSetupPoseBounds(skeleton);

	// Create an AnimationState, and set the initial animation in looping mode.
	let animationStateData = new spine.AnimationStateData(skeleton.data);
	animationStateData.defaultMix = 0.5;
	let animationState = new spine.AnimationState(animationStateData);

	// Pack everything up and return to caller.
	return { skeleton: skeleton, state: animationState, bounds: bounds, premultipliedAlpha: premultipliedAlpha };
}

function calculateSetupPoseBounds(skeleton) {
	skeleton.setToSetupPose();
	skeleton.updateWorldTransform(spine.Physics.update);
	let offset = new spine.Vector2();
	let size = new spine.Vector2();
	skeleton.getBounds(offset, size, []);
	return { offset: offset, size: size };
}

// 
let BloomHidden = false;
let BloomHidden2 = false;
let BloomHidden3 = false;
let BloomHidden4 = false;
let BloomHidden5 = false;

function render() {
    let now = Date.now() / 1000;
    let delta = now - lastFrameTime;

    lastFrameTime = now;

    gl.clearColor(bufferColor[0], bufferColor[1], bufferColor[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Only render if spineData is available
    if (spineData) {
        // Apply the animation state based on the delta time.
        let skeleton = spineData.skeleton;
        let state = spineData.state;
        let premultipliedAlpha = spineData.premultipliedAlpha;
        state.update(delta);
		state.apply(skeleton);

		// 在首次渲染时隐藏 bloom
		if (!BloomHidden) {
			let slot = skeleton.findSlot("bloom_01");
			if (slot) slot.setAttachment(null);
			BloomHidden = true;
		}
		if (!BloomHidden2) {
			let slot = skeleton.findSlot("bloom_02");
			if (slot) slot.setAttachment(null);
			BloomHidden2 = true;
		}
		if (!BloomHidden3) {
			let slot = skeleton.findSlot("bloom_03");
			if (slot) slot.setAttachment(null);
			BloomHidden3 = true;
		}
		if (!BloomHidden4) {
			let slot = skeleton.findSlot("bloom_04");
			if (slot) slot.setAttachment(null);
			BloomHidden4 = true;
		}
		if (!BloomHidden5) {
			let slot = skeleton.findSlot("bloom_05");
			if (slot) slot.setAttachment(null);
			BloomHidden5 = true;
		}

        skeleton.updateWorldTransform(spine.Physics.update);

        // Bind the shader and set the texture and model-view-projection matrix.
        shader.bind();
        // 修改这两行，从 spine.webgl.Shader 改为 spine.Shader
        shader.setUniformi(spine.Shader.SAMPLER, 0);
        shader.setUniform4x4f(spine.Shader.MVP_MATRIX, mvp.values);

        // Start the batch and tell the SkeletonRenderer to render the active skeleton.
        batcher.begin(shader);
        skeletonRenderer.premultipliedAlpha = premultipliedAlpha;
        skeletonRenderer.draw(batcher, skeleton);
        batcher.end();

        shader.unbind();
    }

    // throttle fps
	let elapsed = Date.now() / 1000 - now;
	let targetFrameTime = 1 / targetFps;
	let delay = Math.max(targetFrameTime - elapsed, 0) * 1000;

	drawHitboxes();

	setTimeout(() => {
		requestAnimationFrame(render);
	}, delay);
}

function resize() {
	let w = canvas.clientWidth;
	let h = canvas.clientHeight;
	if (canvas.width != w || canvas.height != h) {
		canvas.width = w;
		canvas.height = h;
	}

	// Set values to position skeleton to center of canvas.
	// Will always attempt to Fit to Fill while maintaining aspect ratio. As a result, a scale of [1] will mean different things across various device resolutions.
	let centerX = 0;
	let centerY = 900;
	let wr = canvas.width / 2560;
	let hr = canvas.height / 1600;
	let width = (2560 / customScale);
	let height = (1600 / customScale);

	if (wr < hr) {
		width = height * (canvas.width / canvas.height);

		transpose = 1600 / canvas.height;
	}
	else if (wr > hr) {
		height = width * (canvas.height / canvas.width);

		transpose = 2560 / canvas.width;
	}
	else {
		transpose = 1600 / canvas.height;
	}

	mvp.ortho2d(centerX - width / 2, centerY - height / 2, width, height);
	gl.viewport(0, 0, canvas.width, canvas.height);
}

init();
