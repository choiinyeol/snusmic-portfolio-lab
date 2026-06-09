import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  {
    ignores: [".next/**", "node_modules/**", ".venv/**", ".tools/**", "data/**", "scripts/__pycache__/**"],
  },
  ...nextVitals,
];

export default eslintConfig;
