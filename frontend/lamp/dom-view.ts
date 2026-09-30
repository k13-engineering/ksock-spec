/*
 * The demo is built with the dom, whose properties are assigned, which the immutable/no-mutation rule forbids by
 * default, so it is switched off for this file.
 */
/* eslint-disable immutable/no-mutation */
import type {
  TDieViewModel,
  TLampSectionViewModel,
  TLampViewModel
} from "../../lib/lamp/view-model.ts";
import { createButtonDomView } from "../components/button/views/dom-view.ts";

const style = `
.lamp-demo {
  padding: 16px;
  border: 1px solid #e1e1dc;
  border-radius: 12px;
  background: #ffffff;
}

.lamp-demo p {
  margin: 0;
}

.lamp-demo .status {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-size: 14px;
}

.lamp-demo .status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.lamp-demo .panels {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}

.lamp-demo .panel {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  padding: 12px;
  border: 1px solid #e1e1dc;
  border-radius: 8px;
}

.lamp-demo .panel-title,
.lamp-demo .model-title {
  font-weight: 600;
}

.lamp-demo .lamp-section {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
}

.lamp-demo .lamp-section[hidden],
.lamp-demo .waiting[hidden] {
  display: none;
}

.lamp-demo .lamp {
  display: flex;
  align-items: center;
  gap: 8px;
}

.lamp-demo .bulb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  transition: background-color 0.2s;
}

.lamp-demo .sequence-note,
.lamp-demo .die-result,
.lamp-demo .waiting {
  color: #5f5f5a;
  font-size: 14px;
}

.lamp-demo .button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  background: #1f5fbf;
  color: #ffffff;
  font: inherit;
  cursor: pointer;
}

.lamp-demo .button:disabled {
  background: #b9c8f2;
  cursor: not-allowed;
}

.lamp-demo .button[aria-busy="true"] {
  background: #1f5fbf;
  cursor: progress;
}

.lamp-demo .button-spinner {
  display: none;
  width: 12px;
  height: 12px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: lamp-demo-spin 0.8s linear infinite;
}

.lamp-demo .button[aria-busy="true"] .button-spinner {
  display: inline-block;
}

@keyframes lamp-demo-spin {
  to {
    transform: rotate(360deg);
  }
}

.lamp-demo .model-title {
  margin-bottom: 8px;
}

.lamp-demo .model {
  margin: 0;
}
`;

// the fixed markup of the demo, what shows in it comes from the view model
const markup = `
<p class="status"><span class="status-dot"></span><span class="status-text"></span></p>
<div class="panels">
  <div class="panel">
    <p class="panel-title">The backend model</p>
    <p class="waiting">Waiting for the backend model…</p>
    <div class="lamp-section">
      <p class="lamp"><span class="bulb"></span><span class="lamp-text"></span></p>
      <div class="switch"></div>
      <p class="sequence-note"></p>
    </div>
  </div>
  <div class="panel">
    <p class="panel-title">Out of band</p>
    <div class="roll"></div>
    <p class="die-result"></p>
  </div>
</div>
<p class="model-title">The backend model as this page has it</p>
<pre class="model"></pre>
`;

// the elements of the demo, in the container, and its style, in the head of the document
const mountLampDemo = ({ container }: { container: HTMLElement }) => {
  const styleElement = document.createElement("style");
  styleElement.textContent = style;
  document.head.append(styleElement);

  const demo = document.createElement("div");
  demo.className = "lamp-demo";
  demo.innerHTML = markup;
  container.append(demo);

  const element = ({ selector }: { selector: string }) => {
    return demo.querySelector(selector) as HTMLElement;
  };

  return {
    styleElement,
    demo,
    element
  };
};

/*
 * The lamp demo in plain html. The view model is memoized, so an identical view model, or an identical part of it,
 * means nothing changed there.
 */
const createLampDomView = ({ container }: { container: HTMLElement }) => {
  const { styleElement, demo, element } = mountLampDemo({ container });

  const buttonSwitch = createButtonDomView({ container: element({ selector: ".switch" }) });
  const buttonRoll = createButtonDomView({ container: element({ selector: ".roll" }) });

  const showLamp = ({ lamp }: { lamp: TLampSectionViewModel | undefined }) => {
    element({ selector: ".waiting" }).hidden = lamp !== undefined;
    element({ selector: ".lamp-section" }).hidden = lamp === undefined;

    if (lamp !== undefined) {
      element({ selector: ".bulb" }).style.backgroundColor = lamp.color;
      element({ selector: ".lamp-text" }).textContent = lamp.text;
      element({ selector: ".sequence-note" }).textContent = lamp.note;
      buttonSwitch.update({ viewModel: lamp.buttonSwitch });
    }
  };

  const showDie = ({ die }: { die: TDieViewModel }) => {
    buttonRoll.update({ viewModel: die.buttonRoll });
    element({ selector: ".die-result" }).textContent = die.resultText;
  };

  let shown: TLampViewModel | undefined = undefined;

  return {
    update: ({ viewModel }: { viewModel: TLampViewModel }) => {
      if (viewModel === shown) {
        return;
      }

      element({ selector: ".status-dot" }).style.backgroundColor = viewModel.status.color;
      element({ selector: ".status-text" }).textContent = viewModel.status.text;
      element({ selector: ".model" }).textContent = viewModel.modelText;
      showLamp({ lamp: viewModel.lamp });
      showDie({ die: viewModel.die });
      shown = viewModel;
    },

    destroy: () => {
      buttonSwitch.destroy();
      buttonRoll.destroy();
      demo.remove();
      styleElement.remove();
    }
  };
};

export {
  createLampDomView
};
