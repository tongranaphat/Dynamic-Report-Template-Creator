@echo off
git show HEAD~1:client/src/composables/useContainerBlocks.js > old_blocks.js
git show HEAD~1:client/src/components/Sidebar.vue > old_sidebar.vue
git log -p -n 5 client/src/composables/useContainerBlocks.js > diff_blocks.txt
git log -p -n 5 client/src/components/Sidebar.vue > diff_sidebar.txt
