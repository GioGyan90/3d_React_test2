# Elemental Pocket · 四元素进球特效

[在线预览](https://giogyan90.github.io/3d_React_test2/elemental-pocket/) · [项目源码](https://github.com/GioGyan90/3d_React_test2/tree/main/elemental-pocket)

四种 Three.js 台球进球特效，基于 `effect.htm` 拆分为 TypeScript：

- `fire`：火舌环绕、收束入洞。
- `thunder`：落雷、电弧和电火花逐步汇聚；闪电带会朝向传入的相机。
- `grass`：落叶错峰出现，旋舞后卷入球洞。
- `ice`：冰晶沿环生长，再依次碎裂、旋入洞中。

这是面向 **Three.js 网页游戏**的效果库。效果不创建渲染器、相机、渲染循环或场景灯光；原生 Unity / Unreal 游戏需要另行实现或通过 Web 容器接入。

## 预览与开发

要求 Node.js 20.19+ 或 22.12+，以及支持 WebGL 的浏览器。

```bash
cd elemental-pocket
npm install
npm run dev
```

`npm run build` 会检查 TypeScript、生成可复用库（`lib/`）和 GitHub Pages 预览（`index.html`、`assets/`）。部署时提交这些生成文件即可，原仓库根目录的页面不需要改动。`npm test` 验证生命周期、并发、复用和资源清理。

预览使用单个 WebGL 渲染器呈现四个视窗；支持单独播放、全部播放、循环与三档画质，系统设置为减少动态效果时默认关闭循环。

## 在游戏中使用

仓库中已包含构建后的 `lib/`。克隆仓库后，在游戏项目中安装兼容版本的 Three.js，再将特效目录作为本地包安装（路径按实际位置调整）：

```bash
npm install three@0.160.1
npm install -D @types/three@0.160.0
npm install ../3d_React_test2/elemental-pocket
```

特效库使用项目提供的 `three` 依赖，已验证版本为 `0.160.1`，请让游戏和特效使用同一份 Three.js。示例：

```ts
import * as THREE from 'three';
import { PocketEffects } from 'elemental-pocket-effects';

// scene、camera、renderer、clock 都来自现有游戏。
const pocketFx = new PocketEffects(scene, {
  camera,
  pixelRatio: renderer.getPixelRatio(),
  quality: 'high', // 'low' | 'medium' | 'high'
});

function onBallPocketed(pocketPosition: THREE.Vector3) {
  pocketFx.play('fire', {
    position: pocketPosition,
    radius: 0.46,
    duration: 3.2,
    onComplete: () => console.log('动画结束'),
  });
}

// 放到游戏已有的每帧循环里：
function tick() {
  const dt = clock.getDelta(); // 秒
  pocketFx.update(dt);
  renderer.render(scene, camera);
}

// 场景切换或卸载时：
pocketFx.dispose();
```

`new PocketEffects(parent, options)` 中的 `parent` 是游戏已有的 `THREE.Scene` 或其他 `THREE.Object3D`。`position` 和 `radius` 均使用该父节点的**局部坐标与单位**；默认以 Y 轴向上，环形位于 XZ 平面。`rotation` 是绕 Y 轴的弧度。若渲染器像素比变化，可调用 `setPixelRatio(renderer.getPixelRatio())`；相机变化时调用 `setCamera(camera)`。

`play` 返回当前播放的句柄，`handle.stop()` 可以提前停止，`handle.active` 可查询状态。完成回调仅在自然播完时调用，手动停止和 `dispose()` 不触发。可以在不同位置同时播放多个相同或不同元素；播放完成后实例会复用，`dispose()` 释放特效自身的几何体、材质与纹理并从父节点移除。

### React Three Fiber 示例

在已有 `<Canvas>` 内使用（`three` 和 `@react-three/fiber` 由游戏项目提供）：

```tsx
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PocketEffects } from 'elemental-pocket-effects';

function PocketEffectsExample() {
  const { scene, camera, gl } = useThree();
  const effects = useRef<PocketEffects | null>(null);
  useFrame((_, delta) => effects.current?.update(delta));
  useEffect(() => {
    const instance = new PocketEffects(scene, { camera, pixelRatio: gl.getPixelRatio() });
    effects.current = instance;
    // 实际游戏中应从进球事件调用此方法。
    instance.play('ice', { position: { x: 0, y: 0, z: 0 }, radius: 0.46 });
    return () => { instance.dispose(); effects.current = null; };
  }, [scene, camera, gl]);
  return null;
}
```

生产接入时，可在场景生命周期内统一创建和销毁 `PocketEffects`，并把进球事件转发给它。

## 目录

```text
elemental-pocket/
  src/index.ts              游戏调用接口与生命周期管理
  src/core/                 基类、数学方法、程序化贴图
  src/effects/              Fire / Thunder / Grass / Ice 独立实现
  demo/                     预览页面源代码
  tests/                    生命周期与集成测试
  lib/                      可复用 ES 模块与 TypeScript 声明
  index.html + assets/      GitHub Pages 预览构建产物
```
