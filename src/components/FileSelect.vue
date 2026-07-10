<template>
  <label
    :for="uploadElemId"
    class="block w-full h-full group relative cursor-pointer font-medium focus-within:outline-none"
  >
    <!-- 外层边框 -->
    <div class="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10 p-[2px]">
      <div class="w-full h-full rounded-3xl bg-white dark:bg-neutral-900"></div>
    </div>
    
    <!-- 内层内容 -->
    <div
      :class="dropZoneClass"
      @drop="handleDrop"
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
    >
      <input
        :id="uploadElemId"
        :name="uploadElemId"
        type="file"
        class="sr-only"
        @change="handleFileChange"
        accept="image/png, image/jpeg, image/webp"
      />
      <div class="flex flex-col items-center gap-3">
        <div class="w-16 h-16 rounded-2xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]">
          <svg class="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        <p class="text-gray-600 dark:text-neutral-300 text-center">{{ dropZoneText }}</p>
      </div>
    </div>
  </label>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import * as m from '../paraglide/messages'
import { stateLanguageTag } from '../paraglide/reactive'

interface Props {
  onSelection: (file: File) => void
}

const props = defineProps<Props>()

const dragHover = ref(false)
const uploadElemId = `file-upload-${Math.random().toString()}`

const dropZoneText = computed(() => {
  stateLanguageTag.value
  return m.drop_zone()
})

const dropZoneClass = computed(() => {
  return [
    'relative w-full h-full flex items-center justify-center px-6 pt-5 pb-6 text-xl',
    'border-2 border-dashed rounded-3xl',
    'hover:border-primary dark:hover:border-primary hover:bg-primary/5 dark:hover:bg-primary/10',
    'text-center transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]',
    dragHover.value
      ? 'border-primary bg-primary/10 dark:bg-primary/20 scale-[1.02]'
      : 'border-gray-300 dark:border-neutral-600 bg-white/50 dark:bg-neutral-800/50',
  ].join(' ')
})

function onFileSelected(file: File) {
  if (!file) {
    return
  }
  const isImage = file.type.match('image.*')
  if (!isImage) {
    return
  }
  try {
    if (file.size > 10 * 1024 * 1024) {
      throw new Error('file too large')
    }
    props.onSelection(file)
  } catch (e) {
    alert(`error: ${(e as any).message}`)
  }
}

async function getFile(entry: any): Promise<File> {
  return new Promise((resolve) => {
    entry.file((file: File) => resolve(file))
  })
}

async function getAllFileEntries(items: DataTransferItemList) {
  const fileEntries: Array<File> = []
  const queue = []
  for (let i = 0; i < items.length; i += 1) {
    queue.push(items[i].webkitGetAsEntry())
  }
  while (queue.length > 0) {
    const entry = queue.shift()
    if (entry?.isFile) {
      const file = await getFile(entry)
      fileEntries.push(file)
    } else if (entry?.isDirectory) {
      queue.push(...(await readAllDirectoryEntries((entry as any).createReader())))
    }
  }
  return fileEntries
}

async function readAllDirectoryEntries(directoryReader: any) {
  const entries = []
  let readEntries = await readEntriesPromise(directoryReader)
  while (readEntries.length > 0) {
    entries.push(...readEntries)
    readEntries = await readEntriesPromise(directoryReader)
  }
  return entries
}

async function readEntriesPromise(directoryReader: any): Promise<any> {
  return new Promise((resolve, reject) => {
    directoryReader.readEntries(resolve, reject)
  })
}

async function handleDrop(ev: DragEvent) {
  ev.preventDefault()
  const items = await getAllFileEntries(ev.dataTransfer!.items)
  dragHover.value = false
  onFileSelected(items[0])
}

function handleDragOver(ev: DragEvent) {
  ev.stopPropagation()
  ev.preventDefault()
  dragHover.value = true
}

function handleDragLeave() {
  dragHover.value = false
}

function handleFileChange(ev: Event) {
  const file = (ev.target as HTMLInputElement).files?.[0]
  if (file) {
    onFileSelected(file)
  }
}
</script>
