<template>
  <div class="min-h-full flex flex-col relative">
    <header class="z-10 border-b border-gray-200 dark:border-neutral-800 flex flex-row items-center md:justify-between h-14 bg-white/50 dark:bg-neutral-900/50 backdrop-blur-sm">
      <Button
        :class="[
          file ? '' : 'opacity-50 pointer-events-none',
          'pl-1 pr-1 mx-1 sm:mx-5',
        ].join(' ')"
        @click="handleStartNew"
      >
        <template #icon>
          <ArrowLeftIcon class="w-6 h-6" />
        </template>
        <div class="md:w-[290px]">
          <span class="hidden sm:inline select-none">
            {{ startNewText }}
          </span>
        </div>
      </Button>
      <div class="text-3xl font-semibold text-gray-900 dark:text-white tracking-tight hover:text-primary transition duration-200 ease-in-out">
        Inpaint-web
      </div>
      <div class="hidden md:flex justify-end w-[300px] mx-1 sm:mx-5">
        <Button class="mr-3 flex" @click="toggleTheme">
          <template #icon>
            <SunIcon v-if="!isDarkMode" class="w-5 h-5" />
            <MoonIcon v-else class="w-5 h-5" />
          </template>
        </Button>
        <Button class="mr-3 flex" @click="toggleLanguage">
          <p>{{ languageTag() === 'en' ? '切换到中文' : 'en' }}</p>
        </Button>
        <Button
          class="w-38 flex sm:visible"
          @click="showAbout = true"
        >
          <template #icon>
            <InformationCircleIcon class="w-6 h-6" />
          </template>
          <p>{{ feedbackText }}</p>
        </Button>
      </div>
    </header>

    <main
      :style="{ height: 'calc(100vh - 56px)' }"
      class="relative"
    >
      <Editor v-if="file" ref="editorRef" :file="file" />
      <div v-else class="flex h-full flex-1 flex-col items-center justify-center overflow-hidden px-4">
        <div class="h-72 sm:w-1/2 max-w-5xl">
          <FileSelect
            @selection="handleFileSelection"
          />
        </div>
        <div class="flex flex-col sm:flex-row pt-10 items-center justify-center cursor-pointer">
          <span class="text-gray-500 dark:text-neutral-400 text-sm">{{ tryItImagesText }}</span>
          <div class="flex space-x-2 sm:space-x-4 px-4">
            <div
              v-for="image in demoImages"
              :key="image"
              @click="startWithDemoImage(image)"
              @keydown="startWithDemoImage(image)"
              role="button"
              tabindex="-1"
              class="transition-all duration-200 hover:scale-105 hover:opacity-90"
            >
              <img
                class="rounded-lg w-auto h-25 ring-1 ring-gray-200 dark:ring-neutral-800 hover:ring-primary/50"
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
import { ref, onMounted, onUnmounted } from 'vue'
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
  onSetLanguageTag,
  setLanguageTag,
} from './paraglide/runtime'

const file = ref<File>()
const stateLanguageTag = ref<'en' | 'zh'>('zh')
const isDarkMode = ref(false)
const editorRef = ref<InstanceType<typeof Editor>>()

onSetLanguageTag(() => {
  stateLanguageTag.value = languageTag() as 'en' | 'zh'
})

onMounted(() => {
  // 默认日间模式
  isDarkMode.value = false
  document.documentElement.classList.remove('dark')
})

const showAbout = ref(false)
const modalRef = ref<HTMLDivElement>()

const downloadProgress = ref(100)

const startNewText = m.start_new()
const feedbackText = m.feedback()
const tryItImagesText = m.try_it_images()
const inpaintModelDownloadMessage = m.inpaint_model_download_message()

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
