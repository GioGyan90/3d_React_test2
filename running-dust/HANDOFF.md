# Lucky Break · Running Dust 新聊天交接

## 项目
GitHub 仓库：https://github.com/GioGyan90/3d_React_test2
分支：main
新展览页面：https://giogyan90.github.io/3d_React_test2/running-dust/
文件：running-dust/index.html、running-dust/style.css、running-dust/scene.js、running-dust/lightning-trail.js、running-dust/README.md

## 最新增量：闪电彩虹加速拖尾

新增文件 running-dust/lightning-trail.js，参考 rainbow-cue 的无硬边连续光雾，左右脚交替向后摆动时喷射彩虹发光粒子和锯齿状分叉电弧；落脚时有短促闪电喷发。保留原烟尘；新增闪电 ON/OFF、极光蓝紫/落日粉金色板和 3.4 秒加速冲刺（真实步频和电光能量同时提升）。scene.js 中脚底来源和冲刺状态已打通。

后续优先在浏览器检查：1) 两只脚是否错峰带电光；2) 彩虹是否是柔光而非分离色条；3) 闪电向脚后方伸展；4) 冲刺前后密度、长度变化；5) 暂停/重置/切换对烟尘没有破坏。检查性能并截图复查。

## 目前任务
完成新独立“跑步扬尘”展览（Three.js 原生 JS）。低模双腿交替跑步时，着地发射 2–9 团大小各异的卡通烟雾，往后散开、缓慢升高与膨胀、透明消失。支持跑速与烟团数滑杆、暂停/继续、单次踩踏、重置以及暖沙/冷灰色调。程序化 3D 低面几何、对象池，不依赖 GLB/贴图。

## 后续检查重点
1. 首先拉取远程 main，读取 running-dust/README.md、scene.js 和本文件。
2. 从线上或本地浏览器实机观察：脚与地面的准确接触、烟团是否沿运动反方向散开、是否有穿模/堆积/不自然节奏。
3. 如需优化，把烟团设计拆成底层铺散、主要团簇、尾部小烟团三个层次，再按角色落地事件组合。
4. 多机位截图复查、移动端检查、提交并发布；此前用户已授权常规修改与提交，无需重复确认。
5. 不要破坏既有 elemental-pocket、power-charge、rainbow-cue 等页面或三维特效。

## 可直接用于下一聊天的指令
继续 Lucky Break 的 Three.js 特效展览馆：仓库 GioGyan90/3d_React_test2 的 main，先读取 running-dust/HANDOFF.md 和 README.md，检查已新增的跑步扬尘页面以及 Three.js 代码。重点检查跑步脚步落地时的低模烟团，以及新加入的左右脚交替闪电彩虹光迹、冲刺加速、暖冷色板和强弱变化；按照“规划元素→分组建模→多角度截图→修正→提交发布”继续迭代。其他既有页面保持不变。
