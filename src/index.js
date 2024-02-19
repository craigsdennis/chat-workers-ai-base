import { Ai } from '@cloudflare/ai';
import { Hono } from 'hono';
import { serveStatic } from 'hono/cloudflare-workers';
import { streamText } from 'hono/streaming';
import { EventSourceParserStream } from 'eventsource-parser/stream';
import manifest from '__STATIC_CONTENT_MANIFEST';

const app = new Hono();

app.get('/*', serveStatic({ root: './', manifest }));

app.post('/api/chat', async (c) => {
	const payload = await c.req.json();
	const ai = new Ai(c.env.AI);
	const messages = [...payload.messages];
	// Prepend the systemMessage
	if (payload?.config?.systemMessage) {
		messages.unshift({ role: 'system', content: payload.config.systemMessage });
	}
	const eventSourceStream = await ai.run(payload.config.model, { messages, stream: true });
	// EventSource stream is handy for local event sources, but we want to just stream text
	const tokenStream = eventSourceStream.pipeThrough(new TextDecoderStream()).pipeThrough(new EventSourceParserStream());

	return streamText(c, async (stream) => {
		for await (const msg of tokenStream) {
			if (msg.data !== '[DONE]') {
				const data = JSON.parse(msg.data);
				stream.write(data.response);
			}
		}
	});
});

export default app;
