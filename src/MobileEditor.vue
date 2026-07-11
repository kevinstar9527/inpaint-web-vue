<template>
  <div
    class="flex flex-col h-full w-full overflow-hidden bg-white dark:bg-neutral-900"
    :class="isInpaintingLoading ? 'animate-pulse-fast pointer-events-none' : ''"
  >
    <!-- Canvas Area - maximize space -->
    <div
      class="flex-grow flex justify-center items-center relative overflow-hidden"
      ref="canvasDiv"
    >
      <div class="relative w-full h-full flex items-center justify-center p-2">
        <canvas
          class="rounded-sm"
          ref="canvasRef"
          style="touch-action: none;"
        />
        <!-- Original image comparison overlay -->
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
        <!-- Loading overlay -->
        <div
          v-if="isInpaintingLoading"
          class="z-10 bg-black/50 backdrop-blur-sm absolute top-0 left-0 right-0 bottom-0 flex justify-center items-center"
        >
          <div class="text-lg space-y-5 w-11/12 bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-xl p-8">
            <p class="text-gray-700 dark:text-neutral-200">正在处理中，请耐心等待...</p>
            <p class="text-gray-700 dark:text-neutral-200">It is being processed, please be patient...</p>
            <Progress :percent="generateProgress" />
          </div>
        </div>
      </div>
    </div>

    <!-- Brush indicator -->
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

    <!-- Upscaled result: only show image + download button -->
    <div v-if="showUpscaledResult" class="flex-shrink-0 bg-white dark:bg-neutral-900 px-3 pb-3 pt-1">
      <button
        class="w-full py-3.5 rounded-full text-white font-semibold text-base transition-all duration-200 active:scale-[0.98] flex items-center justify-center space-x-2 bg-gradient-to-r from-cyan-400 to-cyan-500 shadow-lg shadow-cyan-500/30"
        @click="saveToAlbum"
      >
        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        <span>保存到相册</span>
      </button>
    </div>

    <!-- Bottom Controls (hidden when showing upscaled result) -->
    <div v-else class="flex-shrink-0 bg-white dark:bg-neutral-900 px-3 pb-3 pt-1">
      <!-- Toolbar Row: brush size dots + undo/redo -->
      <div class="flex items-center justify-between w-full py-2">
        <!-- Brush Size Label + Dots -->
        <div class="flex items-center space-x-2">
          <span class="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">画笔粗细</span>
          <div class="flex items-center space-x-2">
            <button
              v-for="(size, idx) in brushSizes"
              :key="idx"
              class="rounded-full transition-all duration-200"
              :class="brushSize === size ? 'bg-green-500 scale-110' : 'bg-gray-300 dark:bg-neutral-600'"
              :style="{ width: `${8 + idx * 4}px`, height: `${8 + idx * 4}px` }"
              @click="brushSize = size"
            />
          </div>
        </div>

        <!-- Undo / Redo -->
        <div class="flex items-center space-x-2">
          <button
            class="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-gray-400 disabled:opacity-30 transition-all active:scale-90"
            :disabled="!canUndo"
            @click="undoStroke"
          >
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 7v6h6" />
              <path d="M3 13a9 9 0 0 1 15-6.7L21 9" />
            </svg>
          </button>
          <button
            class="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-gray-400 disabled:opacity-30 transition-all active:scale-90"
            :disabled="!canRedo"
            @click="redoStroke"
          >
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 7v6h-6" />
              <path d="M21 13a9 9 0 0 0-15-6.7L3 9" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Mode 1: Drawing mode - show "开始擦除" + "4倍放大" buttons -->
      <div v-if="showEraseButton" class="flex space-x-3">
        <button
          class="flex-1 py-3.5 rounded-full text-white font-semibold text-base transition-all duration-200 active:scale-[0.98] flex items-center justify-center space-x-2"
          :class="hasMask ? 'bg-gradient-to-r from-cyan-400 to-cyan-500 shadow-lg shadow-cyan-500/30' : 'bg-gray-300 dark:bg-neutral-700 text-gray-500 dark:text-gray-400'"
          :disabled="!hasMask || isInpaintingLoading"
          @click="startErase"
        >
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 19l7-7 3 3-7 7-3-3z" />
            <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
            <path d="M2 2l7.586 7.586" />
            <circle cx="11" cy="11" r="2" />
          </svg>
          <span>开始擦除</span>
        </button>
        <button
          class="flex-1 py-3.5 rounded-full text-white font-semibold text-base transition-all duration-200 active:scale-[0.98] flex items-center justify-center space-x-2 bg-gradient-to-r from-purple-400 to-purple-500 shadow-lg shadow-purple-500/30"
          :disabled="isInpaintingLoading"
          @click="onSuperResolution"
        >
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M15 3h6v6" />
            <path d="M9 21H3v-6" />
            <path d="M21 3l-7 7" />
            <path d="M3 21l7-7" />
          </svg>
          <span>4倍放大</span>
        </button>
      </div>

      <!-- Mode 2: After erasure - show "保存到相册" + "继续擦除" buttons -->
      <div v-else class="flex space-x-3">
        <button
          class="flex-1 py-3.5 rounded-full border-2 border-cyan-400 text-cyan-500 font-semibold text-base transition-all duration-200 active:scale-[0.98] flex items-center justify-center space-x-2 bg-white dark:bg-neutral-900"
          @click="saveToAlbum"
        >
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          <span>保存到相册</span>
        </button>
        <button
          class="flex-1 py-3.5 rounded-full text-white font-semibold text-base transition-all duration-200 active:scale-[0.98] flex items-center justify-center space-x-2 bg-gradient-to-r from-cyan-400 to-cyan-500 shadow-lg shadow-cyan-500/30"
          @click="continueErase"
        >
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 19l7-7 3 3-7 7-3-3z" />
            <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
            <path d="M2 2l7.586 7.586" />
            <circle cx="11" cy="11" r="2" />
          </svg>
          <span>继续擦除</span>
        </button>
      </div>
    </div>

    <!-- Super Resolution / Download Modal -->
    <Modal v-if="!downloaded">
      <div class="text-xl space-y-5">
        <p>{{ upscaleingModelDownloadMessage }}</p>
        <Progress :percent="downloadProgress" />
      </div>
    </Modal>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed } from 'vue'
import inpaint, { resetModel as resetInpaintModel } from './adapters/inpainting'
import superResolution, { resetModel as resetSuperResolutionModel } from './adapters/superResolution'
import { downloadImage, loadImage, useImage } from './utils'
import Progress from './components/Progress.vue'
import { modelExists, downloadModel } from './adapters/cache'
import Modal from './components/Modal.vue'
import * as m from './paraglide/messages'
import { stateLanguageTag } from './reactive'

interface Props {
  file: File
}

interface Line {
  size?: number
  pts: { x: number; y: number }[]
  src: string
}

const props = defineProps<Props>()

const brushSize = ref(20)
const brushSizes = [10, 20, 30, 40, 50]
const [original, isOriginalLoaded] = useImage(computed(() => props.file))
const renders = ref<HTMLImageElement[]>([])
const context = ref<CanvasRenderingContext2D>()
const maskCanvas = document.createElement('canvas')
// strokes: each element is one complete stroke (one touch-down to touch-up)
const strokes = ref<Line[]>([])
// currentStroke: the stroke being drawn right now
const currentStroke = ref<Line | null>(null)
const brushRef = ref<HTMLDivElement>()
const showBrush = ref(false)
const showOriginal = ref(false)
const isInpaintingLoading = ref(false)
const generateProgress = ref(0)
const originalImgRef = ref<HTMLDivElement>()
const separatorLeft = ref(0)
const scaledBrushSize = computed(() => brushSize.value)
const canvasDiv = ref<HTMLDivElement>()
const canvasRef = ref<HTMLCanvasElement>()
const downloaded = ref(true)
const downloadProgress = ref(0)
const abortController = ref<AbortController | null>(null)
// Redo stacks for strokes
const redoStrokes = ref<Line[]>([])
// Whether to show the "开始擦除" button (true = drawing mode, false = result mode)
const showEraseButton = ref(true)
// Whether showing upscaled result (hide all controls except download)
const showUpscaledResult = ref(false)
// The base file for next erasure (original or last result)
const baseFile = ref<File | null>(null)

const upscaleingModelDownloadMessage = computed(() => {
  stateLanguageTag.value
  return m.upscaleing_model_download_message()
})

// Whether there are any strokes (current or committed) on the canvas
const hasMask = computed(() => {
  return strokes.value.length > 0 || (currentStroke.value !== null && currentStroke.value.pts.length > 0)
})

const canUndo = computed(() => {
  return strokes.value.length > 0 || currentStroke.value !== null
})

const canRedo = computed(() => {
  return redoStrokes.value.length > 0
})

function abortOperation() {
  if (abortController.value) {
    abortController.value.abort()
    abortController.value = null
  }
  isInpaintingLoading.value = false
  resetInpaintModel()
  resetSuperResolutionModel()
}

defineExpose({
  isInpaintingLoading,
  abortOperation,
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

const draw = () => {
  if (!context.value) {
    return
  }
  context.value.clearRect(0, 0, context.value.canvas.width, context.value.canvas.height)
  const currRender = renders.value.length > 0 ? renders.value[renders.value.length - 1] : original.value
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

  context.value.drawImage(currRender, 0, 0, canvas.width, canvas.height)

  // Draw all committed strokes
  drawLines(context.value, strokes.value)
  // Draw current stroke being drawn
  if (currentStroke.value) {
    drawLines(context.value, [currentStroke.value])
  }
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
  // Draw all strokes onto the mask
  drawLines(ctx, strokes.value, 'white')
  if (currentStroke.value) {
    drawLines(ctx, [currentStroke.value], 'white')
  }
}

watch(
  () => [context.value?.canvas, original.value, isOriginalLoaded.value],
  () => {
    if (!context.value?.canvas) {
      return
    }
    if (isOriginalLoaded.value) {
      draw()
    }
  }
)

// Register canvas event listeners once in onMounted
function setupCanvasEvents() {
  const canvas = canvasRef.value
  if (!canvas) return

  const onTouchMove = (ev: TouchEvent) => {
    ev.preventDefault()
    ev.stopPropagation()
    if (!currentStroke.value) return
    const coords = canvas.getBoundingClientRect()
    currentStroke.value.pts.push({
      x: ev.touches[0].clientX - coords.x,
      y: ev.touches[0].clientY - coords.y,
    })
    draw()
  }

  const onMouseDrag = (e: MouseEvent) => {
    if (!currentStroke.value) return
    const px = e.offsetX - canvas.offsetLeft
    const py = e.offsetY - canvas.offsetTop
    currentStroke.value.pts.push({ x: px, y: py })
    draw()
  }

  const onPointerStart = (ev: TouchEvent | MouseEvent) => {
    if (!original.value.src || showOriginal.value) {
      return
    }

    // Clear redo stack when starting new stroke
    redoStrokes.value = []

    // Start a new stroke
    currentStroke.value = {
      size: brushSize.value,
      pts: [],
      src: '',
    }

    if ('touches' in ev) {
      canvas.addEventListener('touchmove', onTouchMove, { passive: false })
    } else {
      canvas.addEventListener('mousemove', onMouseDrag)
    }
  }

  const onTouchEnd = () => {
    canvas.removeEventListener('touchmove', onTouchMove)
    // Commit the current stroke
    if (currentStroke.value && currentStroke.value.pts.length > 0) {
      strokes.value.push(currentStroke.value)
    }
    currentStroke.value = null
    draw()
  }

  const onMouseUp = () => {
    canvas.removeEventListener('mousemove', onMouseDrag)
    // Commit the current stroke
    if (currentStroke.value && currentStroke.value.pts.length > 0) {
      strokes.value.push(currentStroke.value)
    }
    currentStroke.value = null
    draw()
  }

  canvas.addEventListener('touchstart', onPointerStart, { passive: false })
  canvas.addEventListener('touchend', onTouchEnd)
  canvas.addEventListener('mousedown', onPointerStart)
  canvas.addEventListener('mouseup', onMouseUp)

  return () => {
    canvas.removeEventListener('touchstart', onPointerStart)
    canvas.removeEventListener('touchmove', onTouchMove)
    canvas.removeEventListener('touchend', onTouchEnd)
    canvas.removeEventListener('mousedown', onPointerStart)
    canvas.removeEventListener('mousemove', onMouseDrag)
    canvas.removeEventListener('mouseup', onMouseUp)
  }
}

// Undo: remove the last stroke
const undoStroke = () => {
  if (currentStroke.value) {
    // If currently drawing, just cancel the current stroke
    currentStroke.value = null
  } else if (strokes.value.length > 0) {
    // Pop the last committed stroke and push to redo stack
    const lastStroke = strokes.value.pop()
    if (lastStroke) {
      redoStrokes.value.push(lastStroke)
    }
  }
  draw()
}

// Redo: restore the last undone stroke
const redoStroke = () => {
  if (redoStrokes.value.length > 0) {
    const stroke = redoStrokes.value.pop()
    if (stroke) {
      strokes.value.push(stroke)
    }
  }
  draw()
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

// The key "start erase" function - only processes when button is clicked
const startErase = async () => {
  if (!original.value.src || showOriginal.value) {
    return
  }
  if (strokes.value.length === 0 && !currentStroke.value) {
    return
  }

  // Commit current stroke if any
  if (currentStroke.value && currentStroke.value.pts.length > 0) {
    strokes.value.push(currentStroke.value)
    currentStroke.value = null
  }

  const loading = onloading()
  abortController.value = new AbortController()
  const signal = abortController.value.signal
  refreshCanvasMask()

  try {
    const start = Date.now()
    console.log('inpaint_start')
    const sourceFile = baseFile.value ?? props.file
    const res = await inpaint(sourceFile, maskCanvas.toDataURL(), signal)

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

    if (signal.aborted) {
      console.log('inpaint_cancelled_after_load')
      return
    }

    renders.value.push(newRender)
    // Clear strokes after successful erasure
    strokes.value = []
    redoStrokes.value = []
    // Switch to result mode - show save/continue buttons
    showEraseButton.value = false
    // Update baseFile to the result for next erasure
    const blob = await (await fetch(res)).blob()
    baseFile.value = new File([blob], 'result.png', { type: 'image/png' })
    console.log('inpaint_processed', {
      duration: Date.now() - start,
    })
  } catch (e: any) {
    console.log('inpaint_failed', {
      error: e,
    })
    if (e.message !== 'Operation cancelled') {
      if (typeof e === 'number' || (e.message && e.message.includes('session'))) {
        resetInpaintModel()
      }
      alert(e.message ? e.message : e.toString())
    } else {
      resetInpaintModel()
    }
  } finally {
    loading.close()
    abortController.value = null
    if (!signal.aborted) {
      draw()
    }
  }
}

// Continue erasing: same as startErase, process the strokes directly
const continueErase = () => {
  startErase()
}

// 4x Super Resolution
const onSuperResolution = async () => {
  if (!(await modelExists('superResolution'))) {
    downloaded.value = false
    await downloadModel('superResolution', (p: number) => {
      downloadProgress.value = p
    })
    downloaded.value = true
  }
  // First clear strokes so they don't appear during upscale
  strokes.value = []
  redoStrokes.value = []
  currentStroke.value = null
  draw()
  
  isInpaintingLoading.value = true
  abortController.value = new AbortController()
  try {
    const start = Date.now()
    console.log('superResolution_start')
    // Use the last rendered result or original file as the source for upscaling
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
    // Show upscaled result mode: hide all controls, only show download
    showUpscaledResult.value = true
    showEraseButton.value = false
    // Reset inpaint model to avoid session errors when going back
    resetInpaintModel()
    // Redraw canvas with upscaled image
    draw()
    console.log('superResolution_processed', {
      duration: Date.now() - start,
    })
  } catch (error) {
    console.error('superResolution', error)
    if ((error as Error).message !== 'Operation cancelled') {
      const errorMsg = (error as Error).message || String(error)
      if (typeof error === 'number' || errorMsg.includes('session')) {
        resetSuperResolutionModel()
      }
      alert(errorMsg)
    } else {
      resetSuperResolutionModel()
    }
  } finally {
    isInpaintingLoading.value = false
    const wasAborted = abortController.value?.signal.aborted
    abortController.value = null
  }
}

// Save to album
const saveToAlbum = () => {
  const currRender = renders.value.length > 0 ? renders.value[renders.value.length - 1] : original.value
  downloadImage(currRender.currentSrc, 'IMG')
}

const toggleOriginal = () => {
  showOriginal.value = !showOriginal.value
  setTimeout(() => (separatorLeft.value = 0), 300)
}

let cleanupCanvasEvents: (() => void) | undefined

onMounted(() => {
  if (canvasRef.value) {
    const ctx = canvasRef.value.getContext('2d')
    if (ctx) {
      context.value = ctx
    }
  }
  cleanupCanvasEvents = setupCanvasEvents()
})

onUnmounted(() => {
  if (abortController.value) {
    abortController.value.abort()
    abortController.value = null
  }
  cleanupCanvasEvents?.()
})
</script>
