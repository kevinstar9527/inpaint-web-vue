<template>
  <div class="min-h-full flex flex-col relative">
    <header class="z-10 flex flex-row items-center md:justify-between h-20 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border-b border-gray-100/50 dark:border-neutral-800/50">
      <Button
        :class="[
          file ? '' : 'opacity-50 pointer-events-none',
          'pl-3 pr-4 mx-2 sm:mx-6 rounded-full',
        ].join(' ')"
        @click="handleStartNew"
      >
        <template #icon>
          <ArrowLeftIcon class="w-5 h-5" />
        </template>
        <div class="md:w-[290px]">
          <span class="hidden sm:inline select-none">
            {{ startNewText }}
          </span>
        </div>
      </Button>
      <div class="text-center">
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white tracking-tight mb-2">
          {{ m.app_title() }}
        </h1>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          {{ m.app_subtitle() }}
        </p>
      </div>
      <div class="hidden md:flex justify-end w-[300px] mx-2 sm:mx-6 space-x-2">
        <Button class="rounded-full" @click="toggleTheme">
          <template #icon>
            <SunIcon v-if="!isDarkMode" class="w-5 h-5" />
            <MoonIcon v-else class="w-5 h-5" />
          </template>
        </Button>
        <Button class="rounded-full" @click="toggleLanguage">
          <p>{{ stateLanguageTag === 'en' ? '切换到中文' : 'English' }}</p>
        </Button>
        <Button
          class="rounded-full"
          @click="showAbout = true"
        >
          <template #icon>
            <InformationCircleIcon class="w-5 h-5" />
          </template>
          <p>{{ feedbackText }}</p>
        </Button>
      </div>
    </header>

    <main
      :style="{ height: 'calc(100vh - 80px)' }"
      class="relative"
    >
      <Editor v-if="file" ref="editorRef" :file="file" />
      <div v-else class="flex h-full flex-1 flex-col items-center justify-center overflow-hidden px-4 py-12">
        <div class="h-72 sm:w-1/2 max-w-5xl">
          <FileSelect
            @selection="handleFileSelection"
          />
        </div>
        <div class="flex flex-col sm:flex-row pt-12 items-center justify-center cursor-pointer">
          <span class="text-gray-500 dark:text-neutral-400 text-sm mb-4 sm:mb-0 sm:mr-6">{{ tryItImagesText }}</span>
          <div class="flex space-x-3 sm:space-x-5 px-4">
            <div
              v-for="image in demoImages"
              :key="image"
              @click="startWithDemoImage(image)"
              @keydown="startWithDemoImage(image)"
              role="button"
              tabindex="-1"
              class="transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:scale-110 hover:shadow-xl hover:shadow-primary/20 rounded-2xl overflow-hidden"
            >
              <img
                class="rounded-2xl w-auto h-25 ring-2 ring-gray-200/50 dark:ring-neutral-700/50 hover:ring-primary/60 transition-all duration-500"
                :src="`examples/${image}.jpeg`"
                :alt="image"
                :style="{ height: '100px' }"
              />
            </div>
          </div>
        </div>
      </div>
    </main>

    <Modal v-if="showAbout">
      <div ref="modalRef" class="text-lg space-y-5 max-w-2xl">
        <p class="text-gray-700 dark:text-neutral-200">
          任何问题到:
          <a
            href="https://github.com/kevinstar9527/inpaint-web"
            class="text-primary hover:text-primary/80 underline underline-offset-2 transition-colors"
            rel="noreferrer"
            target="_blank"
          >
            Inpaint-web
          </a>
          反馈
        </p>
        <p class="text-gray-700 dark:text-neutral-200">
          For any questions, please go to:
          <a
            href="https://github.com/kevinstar9527/inpaint-web"
            class="text-primary hover:text-primary/80 underline underline-offset-2 transition-colors"
            rel="noreferrer"
            target="_blank"
          >
            Inpaint-web
          </a>
          to provide feedback.
        </p>
      </div>
    </Modal>

    <Modal v-if="downloadProgress < 100">
      <div class="text-lg space-y-5 max-w-2xl">
        <p class="text-gray-700 dark:text-neutral-200">{{ inpaintModelDownloadMessage }}</p>
        <Progress :percent="downloadProgress" />
      </div>
    </Modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { ArrowLeftIcon, InformationCircleIcon, SunIcon, MoonIcon } from '@heroicons/vue/24/outline'
import Button from './components/Button.vue'
import FileSelect from './components/FileSelect.vue'
import Modal from './components/Modal.vue'
import Editor from './Editor.vue'
import { resizeImageFile } from './utils'
import Progress from './components/Progress.vue'
import { downloadModel } from './adapters/cache'
import * as m from './paraglide/messages'
import {
  languageTag,
  setLanguageTag,
} from './paraglide/runtime'
import { stateLanguageTag } from './paraglide/reactive'

const file = ref<File>()
const isDarkMode = ref(false)
const editorRef = ref<InstanceType<typeof Editor>>()

onMounted(() => {
  // 默认日间模式
  isDarkMode.value = false
  document.documentElement.classList.remove('dark')
  // 设置初始 title
  document.title = `${m.app_title()} - ${m.app_subtitle()}`
})

// 监听语言变化更新 title
watch(stateLanguageTag, () => {
  document.title = `${m.app_title()} - ${m.app_subtitle()}`
})

const showAbout = ref(false)
const modalRef = ref<HTMLDivElement>()

const downloadProgress = ref(100)

const startNewText = computed(() => {
  stateLanguageTag.value // 依赖响应式变量以触发更新
  return m.start_new()
})
const feedbackText = computed(() => {
  stateLanguageTag.value
  return m.feedback()
})
const tryItImagesText = computed(() => {
  stateLanguageTag.value
  return m.try_it_images()
})
const inpaintModelDownloadMessage = computed(() => {
  stateLanguageTag.value
  return m.inpaint_model_download_message()
})

const demoImages = ['bag', 'dog', 'car', 'bird', 'jacket', 'shoe', 'paris']

onClickOutside(modalRef, () => {
  showAbout.value = false
})

onMounted(() => {
  downloadModel('inpaint', (p: number) => {
    downloadProgress.value = p
  })
})

async function startWithDemoImage(img: string) {
  const imgBlob = await fetch(`/examples/${img}.jpeg`).then(r => r.blob())
  file.value = new File([imgBlob], `${img}.jpeg`, { type: 'image/jpeg' })
}

async function handleFileSelection(f: File) {
  const { file: resizedFile } = await resizeImageFile(f, 1024 * 4)
  file.value = resizedFile
}

function toggleLanguage() {
  if (languageTag() === 'zh') {
    setLanguageTag('en')
  } else {
    setLanguageTag('zh')
  }
}

function toggleTheme() {
  isDarkMode.value = !isDarkMode.value
  document.documentElement.classList.toggle('dark', isDarkMode.value)
}

function handleStartNew() {
  if (editorRef.value?.isInpaintingLoading) {
    const confirmed = confirm(
      languageTag() === 'zh'
        ? '正在处理中，确定要中止并开始新的编辑吗？'
        : 'Processing in progress. Are you sure you want to abort and start a new edit?'
    )
    if (!confirmed) return
    editorRef.value.abortOperation()
  }
  file.value = undefined
}
</script>
