const domReady = (callback) => {
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', callback);
	} else {
		callback();
	}
};

let md;
domReady(() => {
	md = window.markdownit();
	const chatSettings = retrieveChatSettings();
	if (chatSettings.model !== undefined) {
		document.getElementById('model-select').value = chatSettings.model;
	}
	if (chatSettings.systemMessage !== undefined) {
		document.getElementById('system-message').value = chatSettings.systemMessage;
	}
	renderPreviousMessages();
});

// Based on the message format of `{role: "user", content: "Hi"}`
function createChatMessageElement(msg) {
	const div = document.createElement('div');
	div.className = `message-${msg.role}`;
	if (msg.role === 'assistant') {
		const response = document.createElement('div');
		//response.className = "response";
		const html = md.render(msg.content);
		response.innerHTML = html;
		div.appendChild(response);
		highlightCode(div);
		const modelDisplay = document.createElement('p');
		modelDisplay.className = "message-model";
		const settings = retrieveChatSettings();
		modelDisplay.innerText = settings.model;
		div.appendChild(modelDisplay);
	} else {
		const userMessage = document.createElement("p");
		userMessage.innerText = msg.content;
		div.appendChild(userMessage);
	}
	return div;
}

function retrieveChatSettings() {
	const settingsJSON = localStorage.getItem('chatSettings');
	if (!settingsJSON) {
		// TODO: Defaults?
		return {};
	}
	return JSON.parse(settingsJSON);
}

function storeChatSettings(settings) {
	localStorage.setItem('chatSettings', JSON.stringify(settings));
}

function retrieveMessages() {
	const msgJSON = localStorage.getItem('messages');
	if (!msgJSON) {
		return [];
	}
	return JSON.parse(msgJSON);
}

function storeMessages(msgs) {
	localStorage.setItem('messages', JSON.stringify(msgs));
}

function highlightCode(content) {
	const codeEls = [...content.querySelectorAll('code')];
	for (const codeEl of codeEls) {
		hljs.highlightElement(codeEl);
	}
}

function renderPreviousMessages() {
	console.log('Rendering previous messages');
	const chatHistory = document.getElementById('chat-history');
	const messages = retrieveMessages();
	for (const msg of messages) {
		chatHistory.prepend(createChatMessageElement(msg));
	}
}

async function sendMessage() {
	const config = retrieveChatSettings();
	if (config.model === undefined) {
		applyChatSettingChanges();
	}
	const input = document.getElementById('message-input');
	const chatHistory = document.getElementById('chat-history');

	// Create user message element
	const userMsg = { role: 'user', content: input.value };
	chatHistory.prepend(createChatMessageElement(userMsg));

	const messages = retrieveMessages();
	messages.push(userMsg);
	const payload = { messages, config };

	input.value = '';

	const response = await fetch('/api/chat', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(payload),
	});

	let assistantMsg = { role: 'assistant', content: '' };
	const assistantMessage = createChatMessageElement(assistantMsg);
	chatHistory.prepend(assistantMessage);
	const assistantResponse = assistantMessage.firstChild;

	// Scroll to the latest message
	chatHistory.scrollTop = chatHistory.scrollHeight;

	const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
	while (true) {
		const { value, done } = await reader.read();
		if (done) {
			console.log('Stream done');
			break;
		}
		assistantMsg.content += value;
		// Continually render the markdown => HTML
		// Do not wipe out the model display
		assistantResponse.innerHTML = md.render(assistantMsg.content);
	}
	// Highlight code on completion
	highlightCode(assistantMessage);
	messages.push(assistantMsg);
	storeMessages(messages);
}

function applyChatSettingChanges() {
	const chatHistory = document.getElementById('chat-history');
	chatHistory.innerHTML = '';
	storeMessages([]);
	const chatSettings = {
		model: document.getElementById('model-select').value,
		systemMessage: document.getElementById('system-message').value
	};
	storeChatSettings(chatSettings);
	for (const display of [...document.getElementsByClassName("model-display")]) {
		display.innerText = chatSettings.model;
	}



}

document.getElementById('chat-form').addEventListener('submit', function (e) {
	e.preventDefault();
	sendMessage();
});

document.getElementById('apply-chat-settings').addEventListener('click', function (e) {
	e.preventDefault();
	applyChatSettingChanges();
});
