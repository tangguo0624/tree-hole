<script setup>
// 纯展示组件：字形、涂鸦与滤镜全部内联，不依赖 store，便于在任意页面复用。
// 标题文本保持「树洞」两字连续输出，装饰一律 aria-hidden，屏幕阅读器只会读到完整标题。
</script>

<template>
  <div class="wordmark" data-brand="wordmark">
    <!-- 墨迹滤镜：湍流噪声 + 位移，只抖动 1.5 像素，模拟马克笔边缘的毛糙感，不牺牲可读性 -->
    <svg class="wordmark__filter" width="0" height="0" aria-hidden="true" focusable="false">
      <defs>
        <filter id="wordmark-ink" x="-12%" y="-12%" width="124%" height="124%" color-interpolation-filters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="7" result="wordmarkNoise" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="wordmarkNoise"
            scale="1.5"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>

    <div class="wordmark__stage">
      <!-- hero__title 是集成测试依赖的既有选择器，保留在 h1 上，样式由 brand.css 覆盖 -->
      <h1 class="hero__title wordmark__title">
        <span class="wordmark__char wordmark__char--shu">树</span>
        <span class="wordmark__char wordmark__char--dong">洞</span>
      </h1>

      <!-- 右上角手绘五瓣小花 -->
      <svg class="wordmark__flower" viewBox="0 0 48 48" fill="none" aria-hidden="true" focusable="false">
        <g
          transform="translate(26 20)"
          stroke="var(--leaf-500, #6E9C55)"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <ellipse cx="0" cy="-9" rx="4.8" ry="6.8" />
          <ellipse cx="0" cy="-9" rx="4.8" ry="6.8" transform="rotate(72)" />
          <ellipse cx="0" cy="-9" rx="4.8" ry="6.8" transform="rotate(144)" />
          <ellipse cx="0" cy="-9" rx="4.8" ry="6.8" transform="rotate(216)" />
          <ellipse cx="0" cy="-9" rx="4.8" ry="6.8" transform="rotate(288)" />
          <circle cx="0" cy="0" r="2.6" fill="var(--leaf-500, #6E9C55)" stroke="none" />
          <path d="M-2 5c-2.6 5-3.4 9-2.6 13.5" />
          <path d="M-5 15c-3-1.6-5-1.2-6 0.4 1.8 1.8 4 2 6-0.4z" stroke-width="1.1" />
        </g>
      </svg>

      <!-- 字的左下小点，像落笔时轻敲的一下 -->
      <svg class="wordmark__dot" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
        <circle cx="6" cy="6" r="3" fill="var(--leaf-700, #3E6B34)" />
      </svg>

      <!-- 下方细波浪下划线 -->
      <svg class="wordmark__wave" viewBox="0 0 220 14" fill="none" aria-hidden="true" focusable="false">
        <path
          d="M3 8.5c9-5 18-5 27 0s18 5 27 0 18-5 27 0 18 5 27 0 18-5 27 0 18 5 27 0 18-5 26 0"
          stroke="var(--leaf-500, #6E9C55)"
          stroke-width="2.6"
          stroke-linecap="round"
          opacity="0.85"
        />
      </svg>

      <!-- 一条穿过字脚的细藤蔓 -->
      <svg class="wordmark__vine" viewBox="0 0 240 56" fill="none" aria-hidden="true" focusable="false">
        <path
          d="M3 36c17-13 32 7 49-2s25 10 42-1 27 11 44 0 28 9 45-1 29 8 44 1"
          stroke="var(--leaf-500, #6E9C55)"
          stroke-width="1.4"
          stroke-linecap="round"
          opacity="0.7"
        />
        <g fill="var(--leaf-300, #A8CC8B)" opacity="0.85">
          <path d="M52 34c6-7 13-8 17-5-3 7-10 9-17 5z" />
          <path d="M122 33c6-7 13-8 17-5-3 7-10 9-17 5z" />
          <path d="M188 34c-5-7-12-8-16-5 3 7 9 9 16 5z" />
        </g>
      </svg>
    </div>

    <p class="wordmark__tagline" lang="en">let the wind keep your words</p>
  </div>
</template>
