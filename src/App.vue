<template>
  <div class="min-h-full flex flex-col relative">
    <header class="z-10 shadow flex flex-row items-center md:justify-between h-14">
      <Button
        :class="[
          file ? '' : 'opacity-50 pointer-events-none',
          'pl-1 pr-1 mx-1 sm:mx-5',
        ].join(' ')"
        @click="file = undefined"
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
      <div class="text-4xl font-bold text-blue-600 hover:text-blue-700 transition duration-300 ease-in-out">
        Inpaint-web
      </div>
      <div class="hidden md:flex justify-end w-[300px] mx-1 sm:mx-5">
        <Button class="mr-5 flex" @click="toggleLanguage">
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
      <Editor v-if="file" :file="file" />
      <div v-else class="flex h-full flex-1 flex-col items-center justify-center overflow-hidden">
        <div class="h-72 sm:w-1/2 max-w-5xl">
          <FileSelect
            @selection="handleFileSelection"
          />
        </div>
        <div class="flex flex-col sm:flex-row pt-10 items-center justify-center cursor-pointer">
          <span class="text-gray-500">{{ tryItImagesText }}</span>
          <div class="flex space-x-2 sm:space-x-4 px-4">
            <div
              v-for="image in demoImages"
              :key="image"
              @click="startWithDemoImage(image)"
              @keydown="startWithDemoImage(image)"
              role="button"
              tabindex="-1"
            >
              <img
                class="rounded-md hover:opacity-75 w-auto h-25"
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
      <div ref="modalRef" class="text-xl space-y-5">
        <p>
          任何问题到:
          <a
            href="https://github.com/kevinstar9527/inpaint-web"
            style="color: blue"
            rel="noreferrer"
            target="_blank"
          >
            Inpaint-web
          </a>
          反馈
        </p>
        <p>
          For any questions, please go to:
          <a
            href="https://github.com/kevinstar9527/inpaint-web"
            style="color: blue"
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
      <div class="text-xl space-y-5">
        <p>{{ inpaintModelDownloadMessage }}</p>
        <Progress :percent="downloadProgress" />
      </div>
    </Modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { ArrowLeftIcon, InformationCircleIcon } from '@heroicons/vue/24/outline'
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

onSetLanguageTag(() => {
  stateLanguageTag.value = languageTag() as 'en' | 'zh'
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
  const imgBlob = await fetch(`/inpaint-web/examples/${img}.jpeg`).then(r => r.blob())
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
</script>
