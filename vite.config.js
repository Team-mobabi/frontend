import { defineConfig } from 'vite'

export default defineConfig({
    base: '/mobabi/ui/',
    server: {
        proxy: {
            "/mobabi/app": {
                target: "https://daisy.wisoft.io",
                changeOrigin: true,
                secure: false
            }
        }
    }
});

