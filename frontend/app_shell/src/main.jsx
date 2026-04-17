import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/tokens.css";
import "./styles/app-shell.css";

const mountedRoots = new WeakMap();

function parseShellConfig(root) {
  try {
    return JSON.parse(root.dataset.shellConfig || "{}");
  } catch (error) {
    console.error("Failed to parse shell config.", error);
    return {};
  }
}

function mountShellRoot(root) {
  if (mountedRoots.has(root)) {
    return;
  }

  document.body.dataset.shellReady = "true";

  const reactRoot = createRoot(root);
  mountedRoots.set(root, reactRoot);

  reactRoot.render(
    <React.StrictMode>
      <App config={parseShellConfig(root)} />
    </React.StrictMode>
  );
}

function mountShellRoots(scope = document) {
  scope.querySelectorAll("[data-shell-config]").forEach(mountShellRoot);
}

mountShellRoots();

const shellObserver = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (!(node instanceof Element)) {
        return;
      }

      if (node.matches("[data-shell-config]")) {
        mountShellRoot(node);
        return;
      }

      mountShellRoots(node);
    });
  });
});

shellObserver.observe(document.body, {
  childList: true,
  subtree: true
});
