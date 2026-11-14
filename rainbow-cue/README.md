# Rainbow Cue · Three.js 母球彩虹拖尾

**独立在线页面**：https://giogyan90.github.io/3d_React_test2/rainbow-cue/

这一页与仓库内的 [Elemental Pocket](../elemental-pocket/) 和 [Power Charge](../power-charge/) 完全独立。使用原生 JavaScript + Three.js（固定版本 0.160.1），通过浏览器 ES Module 加载，不改动现有进球特效、力度槽或根目录的 React 构建产物。

## 动画与交互

- **母球**：Three.js 球面几何体、白色高光材质、用于辨识滚动的小色点和地面接触光影。沿正 X 方向移动，按实际移动距离反向绕 Z 轴旋转，模拟无滑动滚动。
- **击打**：点击「击打」从左侧起点发射；再次点击可从起点重新播放，点击「重置」立即停球并清空所有拖尾。
- **速率衰减**：逐帧将初始速度线性衰减（默认滚动阻力常量 2.35 units/s²），减至 0 即停止，不会无限移动；页面底栏显示当前速度。
- **彩虹拖尾**：七条动态彩色 ShaderMaterial 带状几何体（粉红、橙、黄、绿、青、蓝、紫），按球在**世界空间**中的移动距离记录采样点。每条带子在高度/横向具有细微波动，并随时间逐渐透明消散。
- **闪烁星星**：CanvasTexture 程序化生成四角星，再以 Three.js Sprite 绘制。不同位置、尺寸、透明度、闪烁频率和存活时间，使星光持续闪烁、最终自然淡出。
- **操作**：可以使用力度滑块调节发射初速（30–100%）；鼠标或触屏拖拽 3D 预览旋转视角，滚轮缩放；考虑 prefers-reduced-motion 降低星粒子数量。

## 文件

- index.html：独立互动页面与错误提示
- style.css：响应式样式
- scene.js：场景、物理运动、7 条渐变光带、星星、视角和按钮交互

通过 GitHub Pages 可直接打开，不依赖打包；scene.js 从 cdn.jsdelivr.net 加载 Three.js 0.160.1，因此首次使用时需要能访问 CDN。Three.js 模块无法加载或浏览器不支持 WebGL 时会显示错误提示。

## 在游戏中复用

渲染与动画本身已经按相机、球、彩虹网格、星星池、运动控制分离成函数。接入 Lucky Break 的 Three.js 主场景时，建议将场景中的 updateMovement(dt)、updateRibbon()、ageStars() 和 Mesh、Sprite 资源搬到游戏自身的效果控制器中，使用主游戏统一的 Three.js 实例、scene、renderer 与渲染循环，以免重复创建渲染器。

当前实验页面是独立运行的演示，不将球桌物理或游戏击球状态与演示自动同步；这部分应在正式接入时从游戏原有的物理速度读取。
