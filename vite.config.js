import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
    const isDev = mode === "development";

    return {
        plugins: [react()],
        base: "/mobabi/",
        server: isDev
            ? {
                proxy: {
                    "/mobabi/app": {
                        target: "http://127.0.0.1:6101",
                        changeOrigin: true,
                        secure: false,
                    },
                },
            }
            : undefined,
    };
});
