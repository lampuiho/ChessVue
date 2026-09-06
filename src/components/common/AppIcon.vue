<script setup lang="ts">
defineProps<{ name: string; strokeWidth?: number }>();
</script>

<template>
  <svg class="app-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" :stroke-width="strokeWidth ?? 1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <template v-if="name === 'plus'"><path d="M12 5v14M5 12h14" /></template>
    <template v-else-if="name === 'sparkles'"><path d="m12 3 1.3 3.7L17 8l-3.7 1.3L12 13l-1.3-3.7L7 8l3.7-1.3L12 3Z" /><path d="m5 14 .8 2.2L8 17l-2.2.8L5 20l-.8-2.2L2 17l2.2-.8L5 14Zm14-2 .8 2.2L22 15l-2.2.8L19 18l-.8-2.2L16 15l2.2-.8L19 12Z" /></template>
    <template v-else-if="name === 'sliders'"><path d="M4 6h10M18 6h2M4 12h3M11 12h9M4 18h7M15 18h5" /><circle cx="16" cy="6" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="13" cy="18" r="2" /></template>
    <template v-else-if="name === 'folder'"><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2h8.5A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-11Z" /></template>
    <template v-else-if="name === 'save'"><path d="M5 3h12l3 3v15H4V4a1 1 0 0 1 1-1Z" /><path d="M8 3v6h8V3M8 21v-7h8v7" /></template>
    <template v-else-if="name === 'settings'"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" /></template>
    <template v-else-if="name === 'trash'"><path d="M4 7h16M9 3h6l1 4H8l1-4Zm-2 4 1 14h8l1-14M10 11v6M14 11v6" /></template>
    <template v-else-if="name === 'x'"><path d="m6 6 12 12M18 6 6 18" /></template>
    <template v-else-if="name === 'chevron-down'"><path d="m7 9 5 5 5-5" /></template>
    <template v-else-if="name === 'chevron-right'"><path d="m9 7 5 5-5 5" /></template>
    <template v-else-if="name === 'chevron-left'"><path d="m15 7-5 5 5 5" /></template>
    <template v-else-if="name === 'rotate'"><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6.1 8A7 7 0 0 1 18.8 6L20 8M4 16l1.2 2A7 7 0 0 0 17.9 16" /></template>
    <template v-else-if="name === 'undo'"><path d="m9 7-5 5 5 5" /><path d="M20 18v-2a4 4 0 0 0-4-4H4" /></template>
    <template v-else-if="name === 'pause'"><path d="M8 5v14M16 5v14" /></template>
    <template v-else-if="name === 'play'"><path d="m8 5 11 7-11 7V5Z" /></template>
    <template v-else-if="name === 'flag'"><path d="M5 21V4m0 1h11l-2 4 2 4H5" /></template>
    <template v-else-if="name === 'handshake'"><path d="m8 12 3 3a2 2 0 0 0 3 0l4-4" /><path d="m2 10 4-4 4 2 2-1 4 4M3 11l5 6a2 2 0 0 0 3 .2M21 10l-4-4-3 2" /></template>
    <template v-else-if="name === 'activity'"><path d="M3 12h4l2-6 4 12 2-6h6" /></template>
    <template v-else-if="name === 'edit'"><path d="m4 20 4.2-1 10.6-10.6a2 2 0 0 0-2.8-2.8L5.4 16.2 4 20Z" /><path d="m14.5 7.1 2.8 2.8" /></template>
    <template v-else-if="name === 'check'"><path d="m5 12 4 4L19 6" /></template>
    <template v-else-if="name === 'copy'"><rect x="8" y="8" width="11" height="11" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></template>
    <template v-else-if="name === 'download'"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 19h16" /></template>
    <template v-else-if="name === 'upload'"><path d="M12 17V5m0 0 4 4m-4-4L8 9M4 21h16" /></template>
    <template v-else-if="name === 'clock'"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></template>
    <template v-else-if="name === 'history'"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></template>
    <template v-else-if="name === 'arrow-right'"><path d="M5 12h14m-5-5 5 5-5 5" /></template>
    <template v-else-if="name === 'home'"><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10M9 20v-6h6v6" /></template>
    <template v-else-if="name === 'more'"><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" /></template>
    <template v-else-if="name === 'info'"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></template>
    <template v-else><circle cx="12" cy="12" r="9" /></template>
  </svg>
</template>
