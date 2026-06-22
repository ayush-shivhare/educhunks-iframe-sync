import { defineConfig } from 'vite';
import { resolve } from 'path';
import fs from 'fs';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        editor: resolve(__dirname, 'editor.html')
      }
    }
  },
  plugins: [
    {
      name: 'copy-scripts',
      closeBundle() {
        try {
          if (!fs.existsSync(resolve(__dirname, 'dist'))) {
            fs.mkdirSync(resolve(__dirname, 'dist'));
          }
          fs.copyFileSync(resolve(__dirname, 'host.js'), resolve(__dirname, 'dist/host.js'));
          fs.copyFileSync(resolve(__dirname, 'editor.js'), resolve(__dirname, 'dist/editor.js'));
          console.log('Successfully copied host.js and editor.js to dist/');
        } catch (err) {
          console.error('Error copying scripts to dist:', err);
        }
      }
    }
  ]
});
