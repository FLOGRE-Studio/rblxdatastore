import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";

export default defineConfig([
    tseslint.configs.recommended,
    {
        files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],    
        plugins: { js }, 
        extends: ["js/recommended"],
        languageOptions: {
            globals: globals.browser 
        },

        "rules": {
            "array-callback-return": "error",
            "block-scoped-var": "error",
            "class-methods-use-this": "off",
            "consistent-return": "error",
            "curly": "off",
            "default-case": "error",
            "default-case-last": "error",
            "dot-location": ["error", "property"],
            "dot-notation": "error",
            "eqeqeq": ["error", "always", { "null": "ignore" }],
            "guard-for-in": "error",
            "no-alert": "error",
            "no-array-constructor": "error",
            "no-caller": "error",
            "no-case-declarations": "error",
            "no-cond-assign": "error",
            "no-const-assign": "error",
            "no-constant-binary-expression": "error",
            "no-constant-condition": ["error", { "checkLoops": true }],
            "no-control-regex": "error",
            "no-debugger": "error",
            "no-delete-var": "error",
            "no-dupe-args": "error",
            "no-dupe-class-members": "error",
            "no-dupe-else-if": "error",
            "no-dupe-keys": "error",
            "no-duplicate-case": "error",
            "no-else-return": "error",
            "no-empty": ["error", { "allowEmptyCatch": false }],
            "no-empty-function": "error",
            "no-empty-pattern": "error",
            "no-eval": "error",
            "no-ex-assign": "error",
            "no-extend-native": "error",
            "no-extra-boolean-cast": "error",
            "no-extra-label": "error",
            "no-fallthrough": "error",
            "no-func-assign": "error",
            "no-global-assign": "error",
            "no-implied-eval": "error",
            "no-import-assign": "error",
            "no-inner-declarations": ["error", "both"],
            "no-invalid-regexp": "error",
            "no-irregular-whitespace": "error",
            "no-labels": "error",
            "no-lone-blocks": "off",
            "no-loop-func": "error",
            "no-loss-of-precision": "error",
            "no-misleading-character-class": "error",
            "no-new-func": "error",
            "no-new-object": "error",
            "no-new-symbol": "error",
            "no-new-wrappers": "error",
            "no-nonoctal-decimal-escape": "error",
            "no-obj-calls": "error",
            "no-octal": "error",
            "no-octal-escape": "error",
            "no-proto": "error",
            "no-redeclare": ["error", { "builtinGlobals": true }],
            "no-regex-spaces": "error",
            "no-return-assign": ["error", "always"],
            "no-script-url": "error",
            "no-self-assign": "error",
            "no-self-compare": "off",
            "no-sequences": "error",
            "no-setter-return": "error",
            "no-shadow": "error",
            "no-sparse-arrays": "error",
            "no-template-curly-in-string": "error",
            "no-this-before-super": "error",
            "no-throw-literal": "error",
            "no-undef": "off",
            "no-unexpected-multiline": "error",
            "no-unmodified-loop-condition": "off",
            "no-unneeded-ternary": "error",
            "no-unreachable": "error",
            "no-unreachable-loop": "error",
            "@typescript-eslint/no-namespace": "off",
            "no-unsafe-finally": "error",
            "no-unsafe-negation": "error",
            "no-unsafe-optional-chaining": "error",
            "no-unused-labels": "error",
            "no-unused-vars": "off",
            "@typescript-eslint/no-unused-vars": "warn",
            "no-use-before-define": "error",
            "no-useless-backreference": "error",
            "no-useless-call": "error",
            "no-useless-catch": "error",
            "no-useless-computed-key": "error",
            "no-useless-concat": "error",
            "no-useless-constructor": "error",
            "no-useless-escape": "error",
            "no-useless-rename": "error",
            "no-useless-return": "error",
            "no-var": "error",
            "no-void": "error",
            "no-with": "error",
            "prefer-const": "error",
            "prefer-exponentiation-operator": "error",
            "prefer-object-spread": "error",
            "prefer-promise-reject-errors": "error",
            "prefer-rest-params": "error",
            "prefer-spread": "error",
            "radix": "error",
            "require-atomic-updates": "error",
            "require-await": "error",
            "require-yield": "error",
            "symbol-description": "error",
            "use-isnan": "error",
            "valid-typeof": ["error", { "requireStringLiterals": true }],

            /* Imports / ES Modules */
            // "no-restricted-imports": ["error", { "patterns": ["../*"] }],
            "@typescript-eslint/no-require-imports": "error",

            /* Style/Consistency (optional strictness) */
            "strict": ["error", "never"],
            "yoda": ["error", "never"],

            // "@typescript-eslint/naming-convention": [
            //     "error",
            //     // Variables & functions: camelCase
            //     {
            //     "selector": "variable",
            //     "format": ["camelCase"],
            //     "leadingUnderscore": "allow"
            //     },
            //     {
            //     "selector": "function",
            //     "format": ["camelCase"]
            //     },

            //     // Constants: UPPER_CASE
            //     {
            //     "selector": "variable",
            //     "modifiers": ["const"],
            //     "format": ["UPPER_CASE"]
            //     },

            //     // Classes, Interfaces, Types, Enums: PascalCase
            //     {
            //     "selector": "typeLike",
            //     "format": ["PascalCase"]
            //     },

            //     // Enum members: PascalCase
            //     {
            //     "selector": "enumMember",
            //     "format": ["PascalCase"]
            //     },

            //     // Type parameters (generics): prefixed with T (e.g., TKey, TValue)
            //     {
            //     "selector": "typeParameter",
            //     "format": ["PascalCase"],
            //     "prefix": ["T"]
            //     },

            //     // Properties (object fields): camelCase (allow quoted for APIs)
            //     {
            //     "selector": "property",
            //     "format": ["camelCase"],
            //     "leadingUnderscore": "allow",
            //     "modifiers": ["requiresQuotes"]
            //     },

            //     // Boolean variables: must start with is/has/should/can
            //     {
            //     "selector": "variable",
            //     "types": ["boolean"],
            //     "format": ["PascalCase", "camelCase"],
            //     "prefix": ["is", "has", "should", "can"]
            //     }
            // ]
        },
        
    },
]);
