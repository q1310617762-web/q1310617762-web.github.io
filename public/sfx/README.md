# /sfx — 开屏动画音效

## 来源与授权

素材取自 **IgnisForge Free SFX Sampler**（43 个合成复古音效）：

- 页面：https://opengameart.org/content/ignisforge-free-sfx-sampler-43-synthesized-retro-sound-effects
- 授权：**CC0 1.0 Universal（公共领域奉献）** —— 可商用、可修改、**无署名义务**
- 许可原文见包内 `LICENSE.txt`：*"IgnisForge has waived all copyright and
  related or neighboring rights to this sampler pack."*
- 制作者备注：100% 程序化合成，未使用 AI 模型、未使用第三方采样

署名非必需，此处仍保留来源以便追溯。

## 文件与用途

| 文件 | 来源 | 时长 | 用途 | 挑选依据 |
|---|---|---|---|---|
| `dot.wav` | `blip_01.wav` | 0.036s | 吃到普通豆 | 短、谱质心 1388Hz 偏低、打击干脆；一局要响 7 次，不能刺耳 |
| `power.wav` | `coin_15.wav` | 0.137s | 吃到能量豆 | 短且呈**上升**走向（2.0k→2.6kHz，+0.28），像"吃到好东西" |
| `impact.wav` | `explosion_01.wav` | 0.450s | 吃豆人撞毁 | 起音强（包络 0.59）随后衰减，有打击感 |
| `vortex.wav` | `powerup_10.wav` | 0.357s | 黑幕漩涡吸入 | 低频**上升扫频**（1.2k→1.5kHz，+0.30）；播放时降到 0.5 倍速，变深变长 |

## 处理方式

由 `scripts/make-intro-sfx.py` 生成（需 numpy）：混单声道 → 抗混叠降采样
44.1k→22.05k → 掐头去尾静音 → 峰值归一至 −1 dBFS → 首尾加淡入淡出防爆音。

原包为 44.1kHz 立体声，合计约 1.2MB；处理后 4 个文件合计 **42.4 KB**。

## 加载策略

**不预加载。** 浏览器自动播放策略要求用户手势才能出声，所以：

1. 页面加载时完全不请求这些文件（"进来看一眼就走"的访客零额外流量）
2. 用户第一次点击/按键解锁 `AudioContext` 时，才并行拉取这 4 个文件
3. 若开屏已结束则不再拉取；素材未就绪或加载失败时，回落到组件内置的
   Web Audio 合成音，保证任何情况下都有声音

> 副作用（浏览器限制，非本站可绕过）：**首次访问、未做任何点击的访客听不到
> 开屏音效**。这与素材无关 —— 用合成音时同样如此。用户点一下页面后即可解锁。
