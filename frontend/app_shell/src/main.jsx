import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { initializeProgressDocking } from "./bridge/progressDocking";
import "./styles/tokens.css";
import "./styles/app-shell.css";

const mountedRoots = new WeakMap();

initializeProgressDocking();

function parseShellConfig(root) {
  try {
    return JSON.parse(root.dataset.shellConfig || "{}");
  } catch (error) {
    console.error("Failed to parse shell config.", error);
    return {};
  }
}

function renderShellRoot(root, config = parseShellConfig(root)) {
  document.body.dataset.shellReady = "true";
  root.parentElement?.classList?.add("app-shell-host");

  let reactRoot = mountedRoots.get(root);

  if (!reactRoot) {
    reactRoot = createRoot(root);
    mountedRoots.set(root, reactRoot);
  }

  reactRoot.render(
    <React.StrictMode>
      <App config={config} />
    </React.StrictMode>
  );
}

function mountShellRoot(root) {
  renderShellRoot(root);
}

function updateShellRoot(root, config) {
  if (!(root instanceof Element)) {
    return;
  }

  root.dataset.shellConfig = JSON.stringify(config || {});
  renderShellRoot(root, config || {});
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

let customMessageHandlersRegistered = false;
let customMessageRegistrationPoll = null;

function registerCustomMessageHandlers() {
  if (
    customMessageHandlersRegistered ||
    !window.Shiny?.addCustomMessageHandler ||
    !window.Shiny?.shinyapp
  ) {
    return customMessageHandlersRegistered;
  }

  try {
    window.Shiny.addCustomMessageHandler("srnameta:update-shell-config", function (message) {
      const payload = message || {};
      const root = document.getElementById(payload.id || "");

      if (!root) {
        return;
      }

      updateShellRoot(root, payload.config || {});
    });
  } catch (error) {
    return false;
  }

  customMessageHandlersRegistered = true;

  if (customMessageRegistrationPoll) {
    window.clearInterval(customMessageRegistrationPoll);
    customMessageRegistrationPoll = null;
  }

  return true;
}

if (!registerCustomMessageHandlers()) {
  document.addEventListener("shiny:connected", registerCustomMessageHandlers);
  window.addEventListener("load", registerCustomMessageHandlers, { once: true });
  customMessageRegistrationPoll = window.setInterval(registerCustomMessageHandlers, 100);
  window.setTimeout(() => {
    if (customMessageRegistrationPoll) {
      window.clearInterval(customMessageRegistrationPoll);
      customMessageRegistrationPoll = null;
    }
  }, 10000);
}
