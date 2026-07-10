<template>
  <div
    :class="[
      'flex flex-col items-center h-full justify-between',
      isInpaintingLoading ? 'animate-pulse-fast pointer-events-none' : '',
    ].join(' ')"
  >
    <!-- History -->
    <div
      ref="historyListRef"
      :style="{ height: '116px' }"
      :class="[
        'flex-shrink-0',
        'mt-4 border border-gray-200 dark:border-neutral-800 bg-white/50 dark:bg-neutral-900/50 p-3 rounded-lg',
        'flex items-left w-full max-w-4xl',
        'space-y-0 flex-row space-x-5',
        'scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-neutral-700 scrollbar-track-gray-100 dark:scrollbar-track-neutral-900 overflow-x-scroll',
      ].join(' ')"
    >
      <div
        v-for="(render, index) in renders"
        :key="render.dataset.id"
        :style="{
          position: 'relative',
          display: 'inline-block',
          flexShrink: 0,
        }"
      >
        <img
          :src="render.src"
          alt="render"
          class="rounded-sm"
          :style="{ height: '90px' }"
        />
        <Button
          class="hover:opacity-100 opacity-0 cursor-pointer rounded-sm"
          :style="{
            position: 'absolute',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }"
          @click="backTo(index)"
          @enter="draw(index)"
          @leave="draw()"
        >
          <div
            :style="{
              color: '#fff',
              fontSize: '12px',
              textAlign: 'center',
            }"
          >
            回到这
            <br />
            Back here
          </div>
        </Button>
      </div>
    </div>

    <!-- Canvas -->
    <div
      :class="[
        'flex-grow',
        'flex justify-center',
        'my-2',
        'relative',
      ].join(' ')"
      :style="{ width: '70vw' }"
      ref="canvasDiv"
    >
      <div class="relative">
        <canvas
          class="rounded-sm"
          :style="showBrush ? { cursor: 'none' } : {}"
          ref="canvasRef"
        />
        <div
          :class="[
            'absolute top-0 right-0 pointer-events-none',
            showOriginal ? '' : 'overflow-hidden',
          ].join(' ')"
          :style="{
            width: showOriginal ? `${context?.canvas.width}px` : '0px',
            height: `${context?.canvas.height}px`,
            transitionProperty: 'width, height',
            transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
            transitionDuration: '300ms',
          }"
          ref="originalImgRef"
        >
          <div
            :class="[
              'absolute top-0 right-0 pointer-events-none z-10',
              useSeparator ? 'bg-black text-white' : 'bg-primary',
              'w-1',
              'flex items-center justify-center',
              'separator',
            ].join(' ')"
            :style="{
              left: `${separatorLeft}px`,
              height: `${context?.canvas.height}px`,
              transitionProperty: 'width, height',
              transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
              transitionDuration: '300ms',
            }"
          >
            <span class="absolute left-1 bottom-0 p-1 bg-opacity-25 bg-black rounded text-white select-none">
              original
            </span>
            <div
              :class="[
                'absolute py-2 px-1 rounded-md pointer-events-auto',
                useSeparator ? 'bg-black' : 'bg-primary',
              ].join(' ')"
              :style="{ cursor: 'ew-resize' }"
              ref="separatorRef"
            >
              <ViewColumnsIcon class="w-5 h-5" :style="{ cursor: 'ew-resize' }" />
            </div>
          </div>
          <img
            class="absolute right-0"
            :src="original.src"
            alt="original"
            :width="`${context?.canvas.width}px`"
            :height="`${context?.canvas.height}px`"
            :style="{
              width: `${context?.canvas.width}px`,
              height: `${context?.canvas.height}px`,
              maxWidth: 'none',
              clipPath: `inset(0 0 0 ${separatorLeft}px)`,
            }"
          />
        </div>
        <div
          v-if="isInpaintingLoading"
          class="z-10 bg-black/50 backdrop-blur-sm absolute top-0 left-0 right-0 bottom-0 h-full w-full flex justify-center items-center"
        >
          <div ref="modalRef" class="text-lg space-y-5 w-11/12 sm:w-3/4 lg:w-2/3 bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-xl p-8">
            <p class="text-gray-700 dark:text-neutral-200">正在处理中，请耐心等待...</p>
            <p class="text-gray-700 dark:text-neutral-200">It is being processed, please be patient...</p>
            <Progress :percent="generateProgress" />
          </div>
        </div>
      </div>
    </div>

    <Modal v-if="!downloaded">
      <div class="text-xl space-y-5">
        <p>{{ upscaleingModelDownloadMessage }}</p>
        <Progress :percent="downloadProgress" />
      </div>
    </Modal>

    <div
      v-if="showBrush"
      class="fixed rounded-full bg-red-500 bg-opacity-50 pointer-events-none left-0 top-0"
      :style="{
        width: `${scaledBrushSize}px`,
        height: `${scaledBrushSize}px`,
        transform: `translate3d(-100px, -100px, 0)`,
      }"
      ref="brushRef"
    />

    <!-- Toolbar -->
    <div
      :class="[
        'flex-shrink-0',
        'bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-neutral-800 p-4 transition duration-200 ease-in-out',
        'flex items-center w-full max-w-4xl py-6 mb-4, justify-between',
        'flex-col space-y-2 sm:space-y-0 sm:flex-row sm:space-x-5',
      ].join(' ')"
    >
      <Button
        v-if="renders.length > 0"
        primary
        @click="undo"
      >
        <template #icon>
          <svg
            class="w-6 h-6"
            width="19"
            height="9"
            viewBox="0 0 19 9"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M2 1C2 0.447715 1.55228 0 1 0C0.447715 0 0 0.447715 0 1H2ZM1 8H0V9H1V8ZM8 9C8.55228 9 9 8.55229 9 8C9 7.44771 8.55228 7 8 7V9ZM16.5963 7.42809C16.8327 7.92721 17.429 8.14016 17.9281 7.90374C18.4272 7.66731 18.6402 7.07103 18.4037 6.57191L16.5963 7.42809ZM16.9468 5.83205L17.8505 5.40396L16.9468 5.83205ZM0 1V8H2V1H0ZM1 9H8V7H1V9ZM1.66896 8.74329L6.66896 4.24329L5.33104 2.75671L0.331035 7.25671L1.66896 8.74329ZM16.043 6.26014L16.5963 7.42809L18.4037 6.57191L17.8505 5.40396L16.043 6.26014ZM6.65079 4.25926C9.67554 1.66661 14.3376 2.65979 16.043 6.26014L17.8505 5.40396C15.5805 0.61182 9.37523 -0.710131 5.34921 2.74074L6.65079 4.25926Z"
              fill="currentColor"
            />
          </svg>
        </template>
        {{ undoText }}
      </Button>
      <Slider
        :label="brushSizeText"
        :min="10"
        :max="200"
        :value="brushSize"
        @change="handleSliderChange"
        @start="handleSliderStart"
      />
      <Button
        :primary="showOriginal"
        @up="toggleOriginal"
      >
        <template #icon>
          <EyeIcon class="w-6 h-6" />
        </template>
        {{ originalText }}
      </Button>
      <Button v-if="!showOriginal" @up="onSuperResolution">
        {{ upscaleText }}
      </Button>
      <Button
        primary
        @click="download"
      >
        <template #icon>
          <ArrowDownTrayIcon class="w-6 h-6" />
        </template>
        {{ downloadText }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed } from 'vue'
import { useWindowSize } from '@vueuse/core'
import { ArrowDownTrayIcon, EyeIcon, ViewColumnsIcon } from '@heroicons/vue/24/outline'
import inpaint, { resetModel as resetInpaintModel } from './adapters/inpainting'
import superResolution, { resetModel as resetSuperResolutionModel } from './adapters/superResolution'
import Button from './components/Button.vue'
import Slider from './components/Slider.vue'
import { downloadImage, loadImage, useImage } from './utils'
import Progress from './components/Progress.vue'
import { modelExists, downloadModel } from './adapters/cache'
import Modal from './components/Modal.vue'
import * as m from './paraglide/messages'
import { stateLanguageTag } from './paraglide/reactive'

interface Props {
  file: File
}

interface Line {
  size?: number
  pts: { x: number; y: number }[]
  src: string
}

const props = defineProps<Props>()

const brushSize = ref(40)
const [original, isOriginalLoaded] = useImage(computed(() => props.file))
const renders = ref<HTMLImageElement[]>([])
const context = ref<CanvasRenderingContext2D>()
const maskCanvas = document.createElement('canvas')
const lines = ref<Line[]>([{ pts: [], src: '' }])
const brushRef = ref<HTMLDivElement>()
const showBrush = ref(false)
const hideBrushTimeout = ref(0)
const showOriginal = ref(false)
const isInpaintingLoading = ref(false)
const generateProgress = ref(0)
const modalRef = ref<HTMLDivElement>()
const separatorRef = ref<HTMLDivElement>()
const useSeparator = ref(false)
const originalImgRef = ref<HTMLDivElement>()
const separatorLeft = ref(0)
const historyListRef = ref<HTMLDivElement>()
const isBrushSizeChange = ref(false)
const scaledBrushSize = computed(() => brushSize.value)
const canvasDiv = ref<HTMLDivElement>()
const canvasRef = ref<HTMLCanvasElement>()
const downloaded = ref(true)
const downloadProgress = ref(0)
const windowSize = useWindowSize()
const abortController = ref<AbortController | null>(null)

const undoText = computed(() => {
  stateLanguageTag.value
  return m.undo()
})

function abortOperation() {
  if (abortController.value) {
    abortController.value.abort()
    abortController.value = null
  }
  isInpaintingLoading.value = false
  // 立即重置模型，避免 session 损坏导致下次操作失败
  resetInpaintModel()
  resetSuperResolutionModel()
}

defineExpose({
  isInpaintingLoading,
  abortOperation,
})
const brushSizeText = computed(() => {
  stateLanguageTag.value
  return m.bruch_size()
})
const originalText = computed(() => {
  stateLanguageTag.value
  return m.original()
})
const upscaleText = computed(() => {
  stateLanguageTag.value
  return m.upscale()
})
const downloadText = computed(() => {
  stateLanguageTag.value
  return m.download()
})
const upscaleingModelDownloadMessage = computed(() => {
  stateLanguageTag.value
  return m.upscaleing_model_download_message()
})

function drawLines(
  ctx: CanvasRenderingContext2D,
  lineList: Line[],
  color = 'rgba(255, 0, 0, 0.5)'
) {
  ctx.strokeStyle = color
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  lineList.forEach(line => {
    if (!line?.pts.length || !line.size) {
      return
    }
    ctx.lineWidth = line.size
    ctx.beginPath()
    ctx.moveTo(line.pts[0].x, line.pts[0].y)
    line.pts.forEach(pt => ctx.lineTo(pt.x, pt.y))
    ctx.stroke()
  })
}

const BRUSH_HIDE_ON_SLIDER_CHANGE_TIMEOUT = 2000

const draw = (index = -1) => {
  if (!context.value) {
    return
  }
  context.value.clearRect(0, 0, context.value.canvas.width, context.value.canvas.height)
  const currRender =
    renders.value[index === -1 ? renders.value.length - 1 : index] ?? original.value
  const { canvas } = context.value

  const divWidth = canvasDiv.value!.offsetWidth
  const divHeight = canvasDiv.value!.offsetHeight

  const imgAspectRatio = currRender.width / currRender.height
  const divAspectRatio = divWidth / divHeight

  let canvasWidth
  let canvasHeight

  if (divAspectRatio > imgAspectRatio) {
    canvasHeight = divHeight
    canvasWidth = currRender.width * (divHeight / currRender.height)
  } else {
    canvasWidth = divWidth
    canvasHeight = currRender.height * (divWidth / currRender.width)
  }

  canvas.width = canvasWidth
  canvas.height = canvasHeight

  if (currRender?.src) {
    context.value.drawImage(currRender, 0, 0, canvas.width, canvas.height)
  } else {
    context.value.drawImage(original.value, 0, 0, canvas.width, canvas.height)
  }
  const currentLine = lines.value[lines.value.length - 1]
  drawLines(context.value, [currentLine])
}

const refreshCanvasMask = () => {
  if (!context.value?.canvas.width || !context.value?.canvas.height) {
    throw new Error('canvas has invalid size')
  }
  maskCanvas.width = context.value?.canvas.width
  maskCanvas.height = context.value?.canvas.height
  const ctx = maskCanvas.getContext('2d')
  if (!ctx) {
    throw new Error('could not retrieve mask canvas')
  }
  const line = lines.value.slice(-1)[0]
  if (line) drawLines(ctx, [line], 'white')
}

watch(
  () => [context.value?.canvas, original.value, isOriginalLoaded.value, windowSize.width],
  () => {
    if (!context.value?.canvas) {
      return
    }
    if (isOriginalLoaded.value) {
      draw()
    }
  }
)

watch(
  () => [
    brushSize.value,
    context.value,
    props.file,
    lines.value,
    original.value.src,
    renders.value,
    showOriginal.value,
    hideBrushTimeout.value,
  ],
  () => {
    const canvas = context.value?.canvas
    if (!canvas) {
      return
    }

    const onMouseMove = (ev: MouseEvent) => {
      if (brushRef.value) {
        const x = ev.pageX - scaledBrushSize.value / 2
        const y = ev.pageY - scaledBrushSize.value / 2
        brushRef.value.style.transform = `translate3d(${x}px, ${y}px, 0)`
      }
    }

    const onPaint = (px: number, py: number) => {
      const currLine = lines.value[lines.value.length - 1]
      currLine.pts.push({ x: px, y: py })
      draw()
    }

    const onMouseDrag = (ev: MouseEvent) => {
      const px = ev.offsetX - canvas.offsetLeft
      const py = ev.offsetY - canvas.offsetTop
      onPaint(px, py)
    }

    const onPointerUp = async () => {
      if (!original.value.src || showOriginal.value) {
        return
      }
      if (lines.value.slice(-1)[0]?.pts.length === 0) {
        return
      }
      const loading = onloading()
      abortController.value = new AbortController()
      const signal = abortController.value.signal
      canvas.removeEventListener('mousemove', onMouseDrag)
      canvas.removeEventListener('mouseup', onPointerUp)
      refreshCanvasMask()
      try {
        const start = Date.now()
        console.log('inpaint_start')
        const newFile = renders.value.slice(-1)[0] ?? props.file
        const res = await inpaint(newFile, maskCanvas.toDataURL(), signal)

        // 检查是否被取消
        if (signal.aborted) {
          console.log('inpaint_cancelled_after_run')
          return
        }

        if (!res) {
          throw new Error('empty response')
        }
        const newRender = new Image()
        newRender.dataset.id = Date.now().toString()
        await loadImage(newRender, res)

        // 再次检查是否被取消
        if (signal.aborted) {
          console.log('inpaint_cancelled_after_load')
          return
        }

        renders.value.push(newRender)
        lines.value.push({ pts: [], src: '' } as Line)
        console.log('inpaint_processed', {
          duration: Date.now() - start,
        })
      } catch (e: any) {
        console.log('inpaint_failed', {
          error: e,
        })
        if (e.message !== 'Operation cancelled') {
          // 如果是 session 错误，重置模型
          if (typeof e === 'number' || (e.message && e.message.includes('session'))) {
            resetInpaintModel()
          }
          alert(e.message ? e.message : e.toString())
        } else {
          // 如果是取消操作，也重置模型以确保下次能正常工作
          resetInpaintModel()
        }
      } finally {
        if (historyListRef.value) {
          const { scrollWidth, clientWidth } = historyListRef.value
          if (scrollWidth > clientWidth) {
            historyListRef.value.scrollTo(scrollWidth, 0)
          }
        }
        loading.close()
        abortController.value = null
        if (!signal.aborted) {
          draw()
        }
      }
    }

    canvas.addEventListener('mousemove', onMouseMove)

    const onTouchMove = (ev: TouchEvent) => {
      ev.preventDefault()
      ev.stopPropagation()
      const currLine = lines.value[lines.value.length - 1]
      const coords = canvas.getBoundingClientRect()
      currLine.pts.push({
        x: ev.touches[0].clientX - coords.x,
        y: ev.touches[0].clientY - coords.y,
      })
      draw()
    }

    const onPointerStart = () => {
      if (!original.value.src || showOriginal.value) {
        return
      }
      const currLine = lines.value[lines.value.length - 1]
      currLine.size = brushSize.value
      canvas.addEventListener('mousemove', onMouseDrag)
      canvas.addEventListener('mouseup', onPointerUp)
    }

    canvas.addEventListener('touchstart', onPointerStart)
    canvas.addEventListener('touchmove', onTouchMove)
    canvas.addEventListener('touchend', onPointerUp)
    canvas.onmouseenter = () => {
      window.clearTimeout(hideBrushTimeout.value)
      showBrush.value = true && !showOriginal.value
    }
    canvas.onmouseleave = () => (showBrush.value = false)
    canvas.onmousedown = onPointerStart

    return () => {
      canvas.removeEventListener('mousemove', onMouseDrag)
      canvas.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('mouseup', onPointerUp)
      canvas.removeEventListener('touchstart', onPointerStart)
      canvas.removeEventListener('touchmove', onTouchMove)
      canvas.removeEventListener('touchend', onPointerUp)
      canvas.onmouseenter = null
      canvas.onmouseleave = null
      canvas.onmousedown = null
    }
  },
  { deep: true }
)

watch(
  () => [separatorRef.value, context.value],
  () => {
    if (!separatorRef.value || !originalImgRef.value) return

    const separatorMove = (ev: MouseEvent) => {
      ev.preventDefault()
      ev.stopPropagation()
      if (context.value?.canvas) {
        const { width } = context.value?.canvas
        const canvasRect = context.value?.canvas.getBoundingClientRect()
        const separatorOffsetLeft = ev.pageX - canvasRect.left
        if (separatorOffsetLeft <= width && separatorOffsetLeft >= 0) {
          separatorLeft.value = separatorOffsetLeft
        } else if (separatorOffsetLeft < 0) {
          separatorLeft.value = 0
        } else if (separatorOffsetLeft > width) {
          separatorLeft.value = width
        }
      }
    }

    const separatorDown = () => {
      window.addEventListener('mousemove', separatorMove)
      useSeparator.value = true
    }

    const separatorUp = () => {
      window.removeEventListener('mousemove', separatorMove)
      useSeparator.value = false
    }

    separatorRef.value.addEventListener('mousedown', separatorDown)
    window.addEventListener('mouseup', separatorUp)

    return () => {
      separatorRef.value?.removeEventListener('mousedown', separatorDown)
      window.removeEventListener('mouseup', separatorUp)
    }
  }
)

function download() {
  const currRender = renders.value.at(-1) ?? original.value
  downloadImage(currRender.currentSrc, 'IMG')
}

const undo = async () => {
  const l = lines.value
  l.pop()
  l.pop()
  lines.value = [...l, { pts: [], src: '' }]
  const r = renders.value
  r.pop()
  renders.value = [...r]
  draw()
}

watch(
  () => renders.value,
  () => {
    const handler = (event: KeyboardEvent) => {
      if (!renders.value.length) {
        return
      }
      const isCmdZ = (event.metaKey || event.ctrlKey) && event.key === 'z'
      if (isCmdZ) {
        event.preventDefault()
        undo()
      }
    }
    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('keydown', handler)
    }
  },
  { deep: true }
)

const backTo = (index: number) => {
  lines.value.splice(index + 1)
  lines.value = [...lines.value, { pts: [], src: '' }]
  renders.value.splice(index + 1)
  renders.value = [...renders.value]
}

const handleSliderStart = () => {
  showBrush.value = true
}

const handleSliderChange = (sliderValue: number) => {
  if (!isBrushSizeChange.value) {
    isBrushSizeChange.value = true
  }
  if (brushRef.value) {
    const x = document.documentElement.clientWidth / 2 - scaledBrushSize.value / 2
    const y = document.documentElement.clientHeight / 2 - scaledBrushSize.value / 2
    brushRef.value.style.transform = `translate3d(${x}px, ${y}px, 0)`
  }
  brushSize.value = sliderValue
  window.clearTimeout(hideBrushTimeout.value)
  hideBrushTimeout.value = window.setTimeout(() => {
    showBrush.value = false
  }, BRUSH_HIDE_ON_SLIDER_CHANGE_TIMEOUT)
}

const onloading = () => {
  isInpaintingLoading.value = true
  generateProgress.value = 0
  const progressTimer = window.setInterval(() => {
    generateProgress.value = (() => {
      const p = generateProgress.value
      if (p < 90) return p + 10 * Math.random()
      if (p >= 90 && p < 99) return p + 1 * Math.random()
      return p
    })()
  }, 1000)
  return {
    close: () => {
      clearInterval(progressTimer)
      generateProgress.value = 100
      isInpaintingLoading.value = false
    },
  }
}

const onSuperResolution = async () => {
  if (!(await modelExists('superResolution'))) {
    downloaded.value = false
    await downloadModel('superResolution', (p: number) => {
      downloadProgress.value = p
    })
    downloaded.value = true
  }
  isInpaintingLoading.value = true
  abortController.value = new AbortController()
  try {
    const start = Date.now()
    console.log('superResolution_start')
    const newFile = renders.value.at(-1) ?? props.file
    const res = await superResolution(newFile, (p: number) => {
      generateProgress.value = p
    }, abortController.value.signal)
    if (!res) {
      throw new Error('empty response')
    }
    const newRender = new Image()
    newRender.dataset.id = Date.now().toString()
    await loadImage(newRender, res)
    renders.value.push(newRender)
    lines.value.push({ pts: [], src: '' } as Line)
    console.log('superResolution_processed', {
      duration: Date.now() - start,
    })
  } catch (error) {
    console.error('superResolution', error)
    if ((error as Error).message !== 'Operation cancelled') {
      // 如果是 session 错误，重置模型
      const errorMsg = (error as Error).message || String(error)
      if (typeof error === 'number' || errorMsg.includes('session')) {
        resetSuperResolutionModel()
      }
      alert(errorMsg)
    } else {
      // 如果是取消操作，也重置模型以确保下次能正常工作
      resetSuperResolutionModel()
    }
  } finally {
    isInpaintingLoading.value = false
    abortController.value = null
    draw()
  }
}

const toggleOriginal = () => {
  showOriginal.value = !showOriginal.value
  setTimeout(() => (separatorLeft.value = 0), 300)
}

onMounted(() => {
  if (canvasRef.value) {
    const ctx = canvasRef.value.getContext('2d')
    if (ctx) {
      context.value = ctx
    }
  }
})

onUnmounted(() => {
  // 组件卸载时自动中止所有操作
  if (abortController.value) {
    abortController.value.abort()
    abortController.value = null
  }
})
</script>
