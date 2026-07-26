import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        // Browser globals
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        console: "readonly",
        fetch: "readonly",
        URL: "readonly",
        Blob: "readonly",
        FileReader: "readonly",
        setTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        clearTimeout: "readonly",
        requestAnimationFrame: "readonly",
        Image: "readonly",
        Event: "readonly",
        confirm: "readonly",
        alert: "readonly",
        prompt: "readonly",
        history: "readonly",
        location: "readonly",
        HTMLElement: "readonly",
        Element: "readonly",
        Node: "readonly",
        CSSStyleDeclaration: "readonly",
        // MapLibre GL JS
        maplibregl: "readonly",
        // Turf.js
        turf: "readonly",
        // Node.js globals (server-side)
        process: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        module: "readonly",
        require: "readonly",
        exports: "readonly",
        Buffer: "readonly",
        global: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-console": "off",
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-constant-condition": "warn",
      eqeqeq: ["warn", "smart"],
      "no-throw-literal": "error",
      "prefer-const": "warn",
    },
  },
  {
    ignores: [
      "node_modules/",
      "dist/",
      "server/node_modules/",
      "*.min.js",
      "src/map/lib/**",
    ],
  },
];
