"""把选中的 4 个 CC0 音效转成站点用的小体积 WAV。

处理：混单声道 → 抗混叠降采样 44.1k→22.05k → 掐头去尾静音 → 峰值归一到 -1dBFS
      → 首尾加短淡入淡出（避免爆音）→ 写 16bit 单声道 WAV。
目的：开屏音效总体积压到几十 KB 量级，且只在用户交互解锁音频后才按需加载。
"""
import os, wave
import numpy as np

# 输入：从 OpenGameArt 下载并解压的 IgnisForge CC0 音效包（44.1kHz 立体声 WAV）
#   https://opengameart.org/content/ignisforge-free-sfx-sampler-43-synthesized-retro-sound-effects
#   解压后的目录（默认放在系统临时目录，可用 SFX_SRC 覆盖）
SRC = os.environ.get('SFX_SRC') or os.path.join(
    os.environ.get('TEMP', '/tmp'), 'sfx_oga', 'x')
# 输出：站点公开目录。相对本脚本定位，避免写死绝对路径
DST = os.path.normpath(os.path.join(
    os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'sfx'))

# 目标映射：输出名 ← 源文件（挑选依据见 public/sfx/README.md）
PICKS = [
    ('dot.wav',    'blip_01.wav'),      # 吃豆：0.036s，质心 1388Hz，打击干脆
    ('power.wav',  'coin_15.wav'),      # 能量豆：0.142s，2.0k→2.6kHz 上升
    ('impact.wav', 'explosion_01.wav'), # 撞毁：0.45s，攻击 0.59 后衰减
    ('vortex.wav', 'powerup_10.wav'),   # 漩涡：0.36s，低频上升扫频(播放时再降速)
]
SRC_SR = 44100
DST_SR = 22050


def read_wav(path):
    with wave.open(path, 'rb') as w:
        n, ch, sw, sr = w.getnframes(), w.getnchannels(), w.getsampwidth(), w.getframerate()
        raw = w.readframes(n)
    assert sw == 2, 'expect 16-bit'
    a = np.frombuffer(raw, dtype='<i2').astype(np.float64) / 32768.0
    if ch > 1:
        a = a.reshape(-1, ch).mean(axis=1)
    return a, sr


def lowpass_fir(cut, sr, taps=63):
    """窗函数法设计低通 FIR，用于降采样前抗混叠"""
    n = np.arange(taps) - (taps - 1) / 2
    fc = cut / sr
    h = 2 * fc * np.sinc(2 * fc * n) * np.hamming(taps)
    return h / h.sum()


def resample(x, sr_in, sr_out):
    if sr_in == sr_out:
        return x
    h = lowpass_fir(0.45 * sr_out, sr_in)
    y = np.convolve(x, h, mode='same')
    idx = np.arange(0, len(y), sr_in // sr_out)
    return y[idx[:int(len(y) * sr_out / sr_in)]]


def trim_silence(x, sr, rel=0.01, pad_ms=3):
    """掐掉首尾低于 1% 峰值的部分，保留一点边距"""
    if len(x) == 0:
        return x
    thr = max(np.abs(x).max() * rel, 1e-4)
    idx = np.where(np.abs(x) > thr)[0]
    if len(idx) == 0:
        return x
    pad = int(sr * pad_ms / 1000)
    a = max(0, idx[0] - pad)
    b = min(len(x), idx[-1] + pad)
    return x[a:b]


def fade(x, sr, in_ms=2, out_ms=8):
    if len(x) == 0:
        return x
    n_in, n_out = int(sr * in_ms / 1000), int(sr * out_ms / 1000)
    n_in, n_out = min(n_in, len(x) // 2), min(n_out, len(x) // 2)
    if n_in > 0:
        x[:n_in] *= np.linspace(0, 1, n_in)
    if n_out > 0:
        x[-n_out:] *= np.linspace(1, 0, n_out)
    return x


def main():
    os.makedirs(DST, exist_ok=True)
    print('%-12s %-18s %7s %7s %9s  %s' % ('输出', '来源', '时长s', '采样率', '体积B', '峰值dBFS'))
    total = 0
    for out_name, src_name in PICKS:
        x, sr = read_wav(os.path.join(SRC, src_name))
        assert sr == SRC_SR, 'unexpected sr %d' % sr
        x = resample(x, sr, DST_SR)
        x = trim_silence(x, DST_SR)
        peak = np.abs(x).max()
        if peak > 0:
            x = x / peak * 0.891          # -1 dBFS
        x = fade(x, DST_SR)
        pcm = np.clip(np.round(x * 32767), -32768, 32767).astype('<i2')
        path = os.path.join(DST, out_name)
        with wave.open(path, 'wb') as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(DST_SR)
            w.writeframes(pcm.tobytes())
        size = os.path.getsize(path)
        total += size
        db = 20 * np.log10(max(np.abs(x).max(), 1e-9))
        print('%-12s %-18s %7.3f %7d %9d  %+.1f' % (out_name, src_name, len(x) / DST_SR, DST_SR, size, db))
    print('\n合计 %.1f KB' % (total / 1024))


main()
