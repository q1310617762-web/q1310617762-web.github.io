/**
 * 主页 3D 角色：加载游戏模型 → 程序化走路循环 → 沿页面底部巡逻
 *
 * 设计要点：
 * - three.js + FBXLoader 走动态 import，只有首页且开屏结束后才加载（不进首屏）
 * - 骨骼用 3ds Max Biped 的 Z 轴做前后摆（探针实测：绕 Y 会劈叉，绕 X 是扭转）
 * - 移动用 CSS transform 平移舞台，而不是移动 3D 相机（便宜且好和 DOM 对齐）
 * - prefers-reduced-motion / 小屏 → 只呼吸不巡逻
 */
type Three = typeof import('three');

const MODEL_PATH = 'character/model.fbx';
const TEX_BASE = 'character/tex/';

// 材质名（去掉前缀）→ 贴图文件
const TEX_MAP: Record<string, string> = {
  Mat_Hair: 'Hair_Diffuse.webp',
  Mat_Body: 'Body_Diffuse.webp',
  Mat_Body01: 'Body01_Diffuse.webp',
  Mat_Dress: 'Dress_Diffuse.webp',
  Mat_Face: 'Face_Diffuse.webp',
  Mat_Brow: 'Face_Diffuse.webp',
  Mat_Pupil: 'Pupil01_Diffuse.webp',
  Mat_Shell: 'Shell_Diffuse.webp',
  Mat_Crystal: 'Shell_Diffuse.webp',
  Mat_Crystal01: 'Shell_Diffuse.webp',
  Mat_Crystal02: 'Shell_Diffuse.webp',
  Mat_Gauze: 'Dress_Diffuse.webp',
  Mat_Gauze01: 'Dress_Diffuse.webp',
};

export type CharacterOptions = {
  base: string;
  canvas: HTMLCanvasElement;
  stage: HTMLElement;
};

export async function initHomeCharacter({ base, canvas, stage }: CharacterOptions) {
  const THREE = (await import('three')) as Three;
  const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');

  const W = canvas.clientWidth || 260;
  const H = canvas.clientHeight || 360;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(W, H, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9fb0c4, 2.1));
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(1.4, 2.6, 3.2);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xdce8ff, 1.1);
  fill.position.set(-2.6, 1.2, -1.6);
  scene.add(fill);
  const camera = new THREE.PerspectiveCamera(26, W / H, 0.01, 100);

  const texLoader = new THREE.TextureLoader();
  const texCache = new Map<string, import('three').Texture>();
  const getTex = (file: string) => {
    let t = texCache.get(file);
    if (!t) {
      t = texLoader.load(`${base}/${TEX_BASE}${file}`);
      t.colorSpace = THREE.SRGBColorSpace;
      t.flipY = false; // FBX 的 UV 约定
      texCache.set(file, t);
    }
    return t;
  };

  const fbx = await (async () => {
    // FBX 内部引用的是游戏原始贴图路径（Avatar_..._Diffuse.png 等），站点上并不存在。
    // 我们用自己的 WebP 贴图重建材质，所以这里把这些请求改写成一张 1×1 透明图，
    // 否则每次加载首页都会白白产生近 20 个 404。
    const BLANK =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    const manager = new THREE.LoadingManager();
    manager.setURLModifier((url: string) => (/\.(png|jpg|jpeg|tga|bmp)(\?|$)/i.test(url) ? BLANK : url));
    return new FBXLoader(manager).loadAsync(`${base}/${MODEL_PATH}`);
  })();

  const rest = new Map<string, import('three').Quaternion>();
  fbx.traverse((o: any) => {
    if (o.isMesh || o.isSkinnedMesh) {
      const mats = (Array.isArray(o.material) ? o.material : [o.material]).filter(Boolean);
      const built = mats.map((m: any) => {
        const short = String(m.name || '').replace('Avatar_Lady_Bow_Anastasya_', '');
        const file = TEX_MAP[short];
        return new THREE.MeshToonMaterial({
          color: 0xffffff,
          map: file ? getTex(file) : null,
          side: THREE.DoubleSide,
        });
      });
      o.material = Array.isArray(o.material) ? built : built[0];
      o.frustumCulled = false;
    }
    if (o.isBone) rest.set(o.name, o.quaternion.clone());
  });

  scene.add(fbx);
  const box = new THREE.Box3().setFromObject(fbx);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  camera.position.set(center.x, center.y + size.y * 0.03, center.z + size.y * 1.55);
  camera.lookAt(center.x, center.y, center.z);
  camera.updateProjectionMatrix();

  // 让模型「脚下」对齐舞台底部：把模型整体下移，使它以自身脚底为原点
  const footY = box.min.y;
  fbx.position.y -= footY;

  const AXIS = {
    x: new THREE.Vector3(1, 0, 0),
    y: new THREE.Vector3(0, 1, 0),
    z: new THREE.Vector3(0, 0, 1),
  };
  const q = new THREE.Quaternion();
  const setRot = (name: string, axis: 'x' | 'y' | 'z', rad: number) => {
    const b = fbx.getObjectByName(name) as any;
    const r = rest.get(name);
    if (!b || !r) return;
    q.setFromAxisAngle(AXIS[axis], rad);
    b.quaternion.copy(r).multiply(q);
  };

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small = window.matchMedia('(max-width: 768px)').matches;
  const roam = !reduced && !small; // 小屏/减弱动效：只站着呼吸

  // 巡逻范围（视口内）
  const margin = 90;
  const halfStage = (stage.offsetWidth || 260) / 2;
  const maxX = () => Math.max(margin + halfStage, window.innerWidth - margin - halfStage);
  const minX = () => margin + halfStage;
  let dir = 1;
  // 起始位置：右侧偏内，避免一上来就贴着边缘
  let x = Math.min(Math.max(minX(), window.innerWidth * 0.74), maxX());
  const speed = 62; // px/s
  const baseY = -Math.min(window.innerHeight * 0.04, 44);

  let phase = 0;
  let last = performance.now();
  let raf = 0;
  let running = true;

  const tick = (now: number) => {
    if (!running) return;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    if (roam) {
      phase += dt * 7.2; // 步频
      x += dir * speed * dt;
      if (x > maxX()) { x = maxX(); dir = -1; }
      if (x < minX()) { x = minX(); dir = 1; }
    } else {
      phase += dt * 1.6; // 原地呼吸
    }

    const s = Math.sin(phase);
    const s2 = Math.sin(phase + Math.PI);
    const amp = roam ? 1 : 0;

    // 腿：Z 轴前后摆；小腿只向后弯（膝盖不会反折）
    setRot('Bip001_L_Thigh', 'z', 0.40 * amp * s);
    setRot('Bip001_R_Thigh', 'z', 0.40 * amp * s2);
    setRot('Bip001_L_Calf', 'z', -0.50 * amp * Math.max(0, -s));
    setRot('Bip001_R_Calf', 'z', -0.50 * amp * Math.max(0, -s2));
    // 手臂：与同侧腿反相
    setRot('Bip001_L_UpperArm', 'z', -0.26 * amp * s);
    setRot('Bip001_R_UpperArm', 'z', -0.26 * amp * s2);
    setRot('Bip001_L_Forearm', 'z', -0.18 * amp * Math.max(0, s));
    setRot('Bip001_R_Forearm', 'z', -0.18 * amp * Math.max(0, s2));
    // 躯干：走路时轻微起伏与侧倾
    const bob = roam ? Math.abs(Math.sin(phase)) * 0.018 : Math.sin(phase) * 0.006;
    fbx.position.y = -footY + bob;
    setRot('Bip001_Spine1', 'z', (roam ? 0.04 : 0.01) * Math.sin(phase * 2));

    // 朝向：走路时侧身面向行进方向
    const targetY = roam ? dir * Math.PI * 0.5 : 0;
    fbx.rotation.y += (targetY - fbx.rotation.y) * Math.min(1, dt * 6);

    // 位置：无论是否巡逻都必须摆到可视区，否则会停在 CSS 初始的屏幕外位置
    stage.style.transform = `translate3d(${Math.round(x - halfStage)}px, ${Math.round(baseY)}px, 0)`;
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  };
  // 先摆好位置再启动循环，避免第一帧之前不可见
  stage.style.transform = `translate3d(${Math.round(x - halfStage)}px, ${Math.round(baseY)}px, 0)`;
  raf = requestAnimationFrame(tick);

  return {
    destroy() {
      running = false;
      cancelAnimationFrame(raf);
      renderer.dispose();
      scene.traverse((o: any) => {
        if (o.geometry) o.geometry.dispose?.();
        const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
        ms.forEach((m: any) => { m.map?.dispose?.(); m.dispose?.(); });
      });
      texCache.forEach((t) => t.dispose());
    },
  };
}
