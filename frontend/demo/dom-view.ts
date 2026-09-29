/*
 * The demo is built with the dom, whose properties are assigned, which the immutable/no-mutation rule forbids by
 * default, so it is switched off for this file.
 */
/* eslint-disable immutable/no-mutation */
import type { TDemoMessageViewModel, TDemoViewModel } from "../../lib/demo/view-model.ts";
import { createButtonDomView } from "../components/button/views/dom-view.ts";
import { createInputDomView } from "../components/input/views/dom-view.ts";

const style = `
.demo {
  padding: 16px;
  border: 1px solid #e1e1dc;
  border-radius: 12px;
  background: #ffffff;
}

.demo .status {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 12px;
  font-size: 14px;
}

.demo .status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.demo .messages {
  margin: 0 0 12px;
  padding: 0;
  list-style: none;
  font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  font-size: 14px;
}

.demo .messages li {
  display: flex;
  gap: 12px;
  padding: 4px 0;
  border-bottom: 1px solid #f0f0ec;
}

.demo .messages .label {
  flex: 0 0 72px;
  color: #5f5f5a;
}

.demo .messages .text {
  white-space: pre-wrap;
  word-break: break-word;
}

.demo form {
  display: flex;
  gap: 8px;
}

/* a flex item is at least as wide as its content, the min-width lets the field shrink on narrow screens */
.demo label {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-weight: 600;
}

.demo input {
  flex: 1;
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid #c8c8c2;
  border-radius: 6px;
  font: inherit;
  font-weight: normal;
}

.demo button {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  background: #1f5fbf;
  color: #ffffff;
  font: inherit;
  cursor: pointer;
}

.demo button:disabled {
  background: #b9c8f2;
  cursor: not-allowed;
}
`;

// the fixed markup of the demo, what shows in it comes from the view model
const markup = `
<p class="status"><span class="status-dot"></span><span class="status-text"></span></p>
<ol class="messages"></ol>
<form>
  <label class="message">Message</label>
</form>
`;

const messageItemOf = ({ message }: { message: TDemoMessageViewModel }) => {
  const label = document.createElement("span");
  label.className = "label";
  label.textContent = message.label;

  const text = document.createElement("span");
  text.className = "text";
  text.textContent = message.text;

  const item = document.createElement("li");
  item.append(label, text);

  return item;
};

// the elements of the demo, in the container, and its style, in the head of the document
const mountDemo = ({ container }: { container: HTMLElement }) => {
  const styleElement = document.createElement("style");
  styleElement.textContent = style;
  document.head.append(styleElement);

  const demo = document.createElement("div");
  demo.className = "demo";
  demo.innerHTML = markup;
  container.append(demo);

  return {
    styleElement,
    demo,
    statusDot: demo.querySelector(".status-dot") as HTMLElement,
    statusText: demo.querySelector(".status-text") as HTMLElement,
    messages: demo.querySelector(".messages") as HTMLElement,
    form: demo.querySelector("form") as HTMLFormElement,
    messageLabel: demo.querySelector(".message") as HTMLElement
  };
};

/*
 * The live demo in plain html. The view model is memoized, so an identical view model, or an identical part of it,
 * means nothing changed there.
 */
const createDemoDomView = ({ container }: { container: HTMLElement }) => {
  const { styleElement, demo, statusDot, statusText, messages, form, messageLabel } = mountDemo({ container });

  const messageInput = createInputDomView({ container: messageLabel });
  const buttonSend = createButtonDomView({ container: form, label: "Send" });

  // the form only groups the field with its button, the button sends
  const onSubmit = (event: Event) => {
    event.preventDefault();
  };

  form.addEventListener("submit", onSubmit);

  let shown: TDemoViewModel | undefined = undefined;

  const showMessages = ({ viewModel }: { viewModel: TDemoViewModel }) => {
    if (viewModel.messages !== shown?.messages) {
      messages.replaceChildren(...viewModel.messages.map((message) => {
        return messageItemOf({ message });
      }));
    }
  };

  return {
    update: ({ viewModel }: { viewModel: TDemoViewModel }) => {
      if (viewModel === shown) {
        return;
      }

      statusDot.style.background = viewModel.status.color;
      statusText.textContent = viewModel.status.text;
      showMessages({ viewModel });
      messageInput.update({ viewModel: viewModel.messageInput });
      buttonSend.update({ viewModel: viewModel.buttonSend });
      shown = viewModel;
    },

    destroy: () => {
      form.removeEventListener("submit", onSubmit);
      messageInput.destroy();
      buttonSend.destroy();
      demo.remove();
      styleElement.remove();
    }
  };
};

export {
  createDemoDomView
};
