function sendMessage() {
  const input = document.getElementById("message-input");
  const chatArea = document.getElementById("chat-area");
  const model = document.getElementById("model-select").value;

  // Create user message element
  const userMessage = document.createElement("div");
  userMessage.className = "message user";
  userMessage.textContent = input.value;
  chatArea.appendChild(userMessage);

  // TODO: Send message to the server and get a response

  // Clear input field
  input.value = "";

  // Scroll to the latest message
  chatArea.scrollTop = chatArea.scrollHeight;
}

function resetChat() {
  const chatArea = document.getElementById("chat-area");
  chatArea.innerHTML = "";
  // Optionally, reset the model selection to default
  document.getElementById("model-select").selectedIndex = 0;
}

document.getElementById("chat-form").addEventListener("submit", function (e) {
  e.preventDefault(); // Prevents the default form submission action
  sendMessage();
});
