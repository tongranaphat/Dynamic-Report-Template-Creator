const { execSync } = require('child_process');
const fs = require('fs');

try {
  const diff = execSync('git --no-pager log -p -n 10 client/src/components/Sidebar.vue').toString();
  fs.writeFileSync('git_out.txt', diff);
} catch (e) {
  fs.writeFileSync('git_err.txt', e.toString());
}
