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
	renderPreviousMessages();
});

// Based on the message format of `{role: "user", content: "Hi"}`
function createChatMessageElement(msg) {
	const div = document.createElement('div');
	div.className = `message ${msg.role}`;
	if (msg.role === "assistant") {
		const html = md.render(msg.content);
		div.innerHTML = html;
		highlightCode(div);
	} else {
		div.textContent = msg.content;
	}
	return div;
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
	const chatArea = document.getElementById('chat-area');
	const messages = retrieveMessages();
	for (const msg of messages) {
		chatArea.appendChild(createChatMessageElement(msg));
	}
}

async function sendMessage() {
	const input = document.getElementById('message-input');
	const chatArea = document.getElementById('chat-area');
	const model = document.getElementById('model-select').value;
	const systemMessage = document.getElementById('system-message').value;

	// Create user message element
	const userMsg = { role: 'user', content: input.value };
	chatArea.appendChild(createChatMessageElement(userMsg));

	const messages = retrieveMessages();
	messages.push(userMsg);
	const config = {
		model,
		systemMessage,
	};
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
	chatArea.appendChild(assistantMessage);

	// Scroll to the latest message
	chatArea.scrollTop = chatArea.scrollHeight;

	const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
	while (true) {
		const { value, done } = await reader.read();
		if (done) {
			console.log('Stream done');
			break;
		}
		assistantMsg.content += value;
		// Continually render the markdown => HTML
		assistantMessage.innerHTML = md.render(assistantMsg.content);
	}
	// Highlight code on completion
	highlightCode(assistantMessage);
	messages.push(assistantMsg);
	storeMessages(messages);
}

function resetChat() {
	const chatArea = document.getElementById('chat-area');
	chatArea.innerHTML = '';
	storeMessages([]);
}

document.getElementById('chat-form').addEventListener('submit', function (e) {
	e.preventDefault();
	sendMessage();
});
