# Power Charge · 力量蓄力槽

独立在线预览：**https://giogyan90.github.io/3d_React_test2/power-charge/**

这是一个为 Lucky Break 台球游戏准备的 HUD 级能量特效实验，不修改已有进球特效。视觉语言延续相邻的 [Elemental Pocket](../elemental-pocket/) 展示页。使用 **Canvas 2D + JavaScript ES Module**，无需构建步骤、外链图片或新依赖；可直接部署到 GitHub Pages。

## 行为

0. **槽体结构（默认）**：细长倒梯形，固定分为 **10 个独立横向区块**，梯形顶部宽约 **45px**、底部最大宽约 **100px**（逻辑坐标按 320px 宽计算；预览页面已等比缩至 75%，实际可见顶部约 34px、底部约 75px），相邻区块之间留有明显的 **9 Canvas 单位**空隙；由上至下青绿、青蓝、蓝、蓝紫逐渐转为玫瑰、金橙和暖红。未蓄力时各段以低亮度显示，蓄力后逐段增强发光。段内填充仍严格遵守十段轮廓，不会填满间隙；大范围爆炸粒子则在独立画布上向槽外飞散。
1. **蓄力（charge）**：上窄下宽的梯形，鼠标/手指从上向下拖动；拖到最下方红色区块的顶部即判定 100%，立即开始 1.5 秒震动倒计时，无须把指针拉到整块画布底端。能量从槽顶逐格向槽底填充。中途松手会保留当前百分比，也可继续拖动。键盘方向键每次改变 5%，PageUp/PageDown 每次改变 20%，Home/End 对应 0%/100%。
2. **满槽震动（hold）**：到达 100% 后立即锁定输入、触发高频震动和电弧，保持**恰好 1500 毫秒的动画时间**；右侧状态与倒计时同步。用户切换到后台标签时动画暂停，不会因为后台计时跳帧。
3. **爆炸（burst）**：1.5 秒后进入时长 **1450 毫秒**的爆裂，包含中心闪光、扩散冲击波与飞散粒子；槽内保留分段遮罩，同时有独立全预览覆盖画布，**外扩的光晕、冲击环和大量火花可超出梯形**。
4. **清空（clearing）**：爆炸结束后在 **480 毫秒**内归零，并回到 idle，允许下一次蓄力。

页内有「自动演示」和「重置」按钮；按 Enter / Space 也可触发自动演示。遵循浏览器的 `prefers-reduced-motion`，减少震动和粒子量。

## 文件结构

- `index.html` — 展示页面、无障碍状态标签、导航。
- `style.css` — 页面版式、装饰、响应式样式与满槽震动。
- `charge-meter.js` — 可复用的 `PowerChargeMeter` 类及本展示页的状态 UI 绑定。

## 游戏接入（非 React DOM / Three.js HUD 也可使用）

将 HTML 中的 `energy-slot` 和内部 `energy-canvas` 放进游戏 HUD，并可选加入覆盖整个展示区域的 `burst-canvas`，导入类即可。预览模块在没有演示页面的 DOM 节点时不会初始化额外实例。蓄力过程中不再绘制矩形进度边线，只逐格点亮十个梯形段。

```js
import { PowerChargeMeter } from './power-charge/charge-meter.js';

const meter = new PowerChargeMeter({
  canvas: document.querySelector('#energy-canvas'),
  surface: document.querySelector('#energy-slot'),
  burstCanvas: document.querySelector('#burst-canvas'), // 可选：建议放在槽体外并覆盖整个游戏 HUD
  onUpdate: ({ progress, percent, phase, remaining }) => {
    // progress 0–1, percent 0–100
    // remaining 仅在 hold 阶段倒计时
  },
  onPhaseChange: (phase) => {
    // idle / charging / hold / burst / clearing
    if (phase === 'burst') {
      // 在这里触发额外的击球、相机或音效事件
    }
  }
});

// 自定义输入时使用：对外 API 的蓄力值为 0–1
meter.setCharge(0.65); 
meter.setCharge(1); // 锁定满槽，1.5 秒后自动爆炸与清空

// 演示 / 清理：
meter.autoCharge();
meter.reset();
meter.destroy(); // 卸载页面或 React useEffect cleanup 时调用
```

注意：`style.css` 中的 `.energy-slot` 应有明确尺寸，推荐 320:680 纵横比。渲染坐标固定为 320×680，但会根据实际元素尺寸和设备像素比自动缩放。模块只管理界面表现和触控，不依赖 WebGL 渲染器，也不会修改球桌物理逻辑。

## 测试要点

- 拖动到 40% 后松手，应该保留 40%，再拖可继续。
- 拖到 100%，界面锁定 1.5→0.0 秒并持续震动。
- 满 1.5 秒后在梯形内爆炸；爆炸后清空并可再次拖动。
- 任何阶段点击「重置」均应立即停止当前效果。
- 触屏下滚动不会劫持槽体的拖动手势；按 Tab 可聚焦槽并使用方向键。
