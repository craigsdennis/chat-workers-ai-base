// node_modules/@cloudflare/ai/dist/index.js
var TypedArrayProto = Object.getPrototypeOf(Uint8Array);
function isArray(value) {
  return Array.isArray(value) || value instanceof TypedArrayProto;
}
function arrLength(obj) {
  return obj instanceof TypedArrayProto ? obj.length : obj.flat(Infinity).reduce((acc, cur) => acc + (cur instanceof TypedArrayProto ? cur.length : 1), 0);
}
function ensureShape(shape, value) {
  if (shape.length === 0 && !isArray(value)) {
    return;
  }
  const count = shape.reduce((acc, v) => {
    if (!Number.isInteger(v)) {
      throw new Error(`expected shape to be array-like of integers but found non-integer element "${v}"`);
    }
    return acc * v;
  }, 1);
  if (count != arrLength(value)) {
    throw new Error(
      `invalid shape: expected ${count} elements for shape ${shape} but value array has length ${value.length}`
    );
  }
}
function ensureType(type, value) {
  if (isArray(value)) {
    value.forEach((v) => ensureType(type, v));
    return;
  }
  switch (type) {
    case "bool": {
      if (typeof value === "boolean") {
        return;
      }
      break;
    }
    case "float16":
    case "float32": {
      if (typeof value === "number") {
        return;
      }
      break;
    }
    case "int8":
    case "uint8":
    case "int16":
    case "uint16":
    case "int32":
    case "uint32": {
      if (Number.isInteger(value)) {
        return;
      }
      break;
    }
    case "int64":
    case "uint64": {
      if (typeof value === "bigint") {
        return;
      }
      break;
    }
    case "str": {
      if (typeof value === "string") {
        return;
      }
      break;
    }
  }
  throw new Error(`unexpected type "${type}" with value "${value}".`);
}
function serializeType(type, value) {
  if (isArray(value)) {
    return [...value].map((v) => serializeType(type, v));
  }
  switch (type) {
    case "str":
    case "bool":
    case "float16":
    case "float32":
    case "int8":
    case "uint8":
    case "int16":
    case "uint16":
    case "uint32":
    case "int32": {
      return value;
    }
    case "int64":
    case "uint64": {
      return value.toString();
    }
  }
  throw new Error(`unexpected type "${type}" with value "${value}".`);
}
function deserializeType(type, value) {
  if (isArray(value)) {
    return value.map((v) => deserializeType(type, v));
  }
  switch (type) {
    case "str":
    case "bool":
    case "float16":
    case "float32":
    case "int8":
    case "uint8":
    case "int16":
    case "uint16":
    case "uint32":
    case "int32": {
      return value;
    }
    case "int64":
    case "uint64": {
      return BigInt(value);
    }
  }
  throw new Error(`unexpected type "${type}" with value "${value}".`);
}
var Tensor = class _Tensor {
  type;
  value;
  name;
  shape;
  constructor(type, value, opts = {}) {
    this.type = type;
    this.value = value;
    ensureType(type, this.value);
    if (opts.shape === void 0) {
      if (isArray(this.value)) {
        this.shape = [arrLength(value)];
      } else {
        this.shape = [];
      }
    } else {
      this.shape = opts.shape;
    }
    ensureShape(this.shape, this.value);
    this.name = opts.name || null;
  }
  static fromJSON(obj) {
    const { type, shape, value, b64Value, name } = obj;
    const opts = { shape, name };
    if (b64Value !== void 0) {
      const value2 = b64ToArray(b64Value, type)[0];
      return new _Tensor(type, value2, opts);
    } else {
      return new _Tensor(type, deserializeType(type, value), opts);
    }
  }
  toJSON() {
    return {
      type: this.type,
      shape: this.shape,
      name: this.name,
      value: serializeType(this.type, this.value)
    };
  }
};
function b64ToArray(base64, type) {
  const byteString = atob(base64);
  const bytes = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i++) {
    bytes[i] = byteString.charCodeAt(i);
  }
  const arrBuffer = new DataView(bytes.buffer).buffer;
  switch (type) {
    case "float32":
      return new Float32Array(arrBuffer);
    case "float64":
      return new Float64Array(arrBuffer);
    case "int32":
      return new Int32Array(arrBuffer);
    case "int64":
      return new BigInt64Array(arrBuffer);
    default:
      throw Error(`invalid data type for base64 input: ${type}`);
  }
}
var tgTemplates = {
  // ex: https://huggingface.co/TheBloke/deepseek-coder-6.7B-base-AWQ
  bare: {
    system: {
      flag: 2
      /* ABSORB_ROLE */
    },
    user: {
      flag: 3
      /* APPEND_LAST_SYSTEM */
    },
    assistant: {
      pre: " ",
      post: " "
    }
  },
  //
  sqlcoder: {
    system: {
      flag: 2
      /* ABSORB_ROLE */
    },
    user: {
      flag: 2
      /* ABSORB_ROLE */
    },
    assistant: {
      flag: 2
      /* ABSORB_ROLE */
    },
    global: {
      template: "### Task\nGenerate a SQL query to answer [QUESTION]{user}[/QUESTION]\n\n### Database Schema\nThe query will run on a database with the following schema:\n{system}\n\n### Answer\nGiven the database schema, here is the SQL query that [QUESTION]{user}[/QUESTION]\n[SQL]"
    }
  },
  // ex: https://huggingface.co/TheBloke/LlamaGuard-7B-AWQ
  inst: {
    system: {
      flag: 2
      /* ABSORB_ROLE */
    },
    user: {
      pre: "[INST] ",
      post: " [/INST]",
      flag: 3
      /* APPEND_LAST_SYSTEM */
    },
    assistant: {
      pre: " ",
      post: " "
    }
  },
  // https://github.com/facebookresearch/llama/blob/main/llama/generation.py#L340-L361
  // https://replicate.com/blog/how-to-prompt-llama
  // https://huggingface.co/TheBloke/Llama-2-13B-chat-AWQ#prompt-template-llama-2-chat
  llama2: {
    system: {
      pre: "[INST] <<SYS>>\n",
      post: "\n<</SYS>>\n\n"
    },
    user: {
      pre: "<s>[INST] ",
      post: " [/INST]",
      flag: 1
      /* CARRY_SYSTEM_INST */
    },
    assistant: {
      pre: " ",
      post: "</s>"
    }
  },
  // https://huggingface.co/TheBloke/deepseek-coder-6.7B-instruct-AWQ
  deepseek: {
    system: {
      post: "\n"
    },
    user: {
      pre: "### Instruction:\n",
      post: "\n"
    },
    assistant: {
      pre: "### Response:\n",
      post: "\n"
    },
    global: {
      post: "### Response:\n"
    }
  },
  // https://huggingface.co/TheBloke/Falcon-7B-Instruct-GPTQ
  falcon: {
    system: {
      post: "\n"
    },
    user: {
      pre: "User: ",
      post: "\n"
    },
    assistant: {
      pre: "Assistant: ",
      post: "\n"
    },
    global: {
      post: "Assistant: \n"
    }
  },
  // https://huggingface.co/TheBloke/openchat_3.5-AWQ#prompt-template-openchat
  openchat: {
    system: {
      flag: 2
      /* ABSORB_ROLE */
    },
    user: {
      pre: "GPT4 User: ",
      post: "<|end_of_turn|>",
      flag: 3
      /* APPEND_LAST_SYSTEM */
    },
    assistant: {
      pre: "GPT4 Assistant: ",
      post: "<|end_of_turn|>"
    },
    global: {
      post: "GPT4 Assistant:"
    }
  },
  // https://huggingface.co/openchat/openchat#conversation-template
  "openchat-alt": {
    system: {
      flag: 2
      /* ABSORB_ROLE */
    },
    user: {
      pre: "<s>Human: ",
      post: "<|end_of_turn|>",
      flag: 3
      /* APPEND_LAST_SYSTEM */
    },
    assistant: {
      pre: "Assistant: ",
      post: "<|end_of_turn|>"
    },
    global: {
      post: "Assistant: "
    }
  },
  // https://huggingface.co/TinyLlama/TinyLlama-1.1B-Chat-v1.0
  tinyllama: {
    system: {
      pre: "<|system|>\n",
      post: "</s>\n"
    },
    user: {
      pre: "<|user|>\n",
      post: "</s>\n"
    },
    assistant: {
      pre: "<|assistant|>\n",
      post: "</s>\n"
    },
    global: {
      post: "<|assistant|>\n"
    }
  },
  // https://huggingface.co/TheBloke/OpenHermes-2.5-Mistral-7B-AWQ#prompt-template-chatml
  // https://huggingface.co/TheBloke/Orca-2-13B-AWQ#prompt-template-chatml
  chatml: {
    system: {
      pre: "<|im_start|>system\n",
      post: "<|im_end|>\n"
    },
    user: {
      pre: "<|im_start|>user\n",
      post: "<|im_end|>\n"
    },
    assistant: {
      pre: "<|im_start|>assistant\n",
      post: "<|im_end|>\n"
    },
    global: {
      post: "<|im_start|>assistant\n"
    }
  },
  // https://huggingface.co/TheBloke/neural-chat-7B-v3-1-AWQ#prompt-template-orca-hashes
  "orca-hashes": {
    system: {
      pre: "### System:\n",
      post: "\n\n"
    },
    user: {
      pre: "### User:\n",
      post: "\n\n"
    },
    assistant: {
      pre: "### Assistant:\n",
      post: "\n\n"
    },
    global: {
      post: "### Assistant:\n\n"
    }
  },
  // https://huggingface.co/TheBloke/CodeLlama-7B-Instruct-AWQ#prompt-template-codellama
  "codellama-instruct": {
    system: {
      pre: "[INST] ",
      post: "\n"
    },
    user: {
      pre: "[INST] ",
      post: " [/INST]\n",
      flag: 1
      /* CARRY_SYSTEM_INST */
    },
    assistant: {
      post: "\n"
    }
  },
  // https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.1-AWQ#prompt-template-mistral
  "mistral-instruct": {
    system: {
      pre: "<s>[INST] ",
      post: " "
    },
    user: {
      pre: "[INST] ",
      post: " [/INST]",
      flag: 1
      /* CARRY_SYSTEM_INST */
    },
    assistant: {
      pre: " ",
      post: "</s>"
    }
  },
  // https://huggingface.co/TheBloke/zephyr-7B-beta-AWQ#prompt-template-zephyr
  // https://huggingface.co/HuggingFaceH4/zephyr-7b-alpha
  zephyr: {
    system: {
      pre: "<s><|system|>\n",
      post: "</s>\n"
    },
    user: {
      pre: "<|user|>\n",
      post: "</s>\n"
    },
    assistant: {
      pre: "<|assistant|>\n",
      post: "</s>\n"
    },
    global: {
      post: "<|assistant|>\n"
    }
  }
};
var generateTgTemplate = (messages, template) => {
  let prompt = "";
  const state = {
    lastSystem: false,
    systemCount: 0,
    lastUser: false,
    userCount: 0,
    lastAssistant: false,
    assistantCount: 0
  };
  for (const message of messages) {
    switch (message.role) {
      case "system":
        state.systemCount++;
        state.lastSystem = message.content;
        prompt += applyRole(template, message.role, message.content, state);
        break;
      case "user":
        state.userCount++;
        state.lastUser = message.content;
        prompt += applyRole(template, message.role, message.content, state);
        break;
      case "assistant":
        state.assistantCount++;
        state.lastAssistant = message.content;
        prompt += applyRole(template, message.role, message.content, state);
        break;
    }
  }
  prompt = applyRole(template, "global", prompt, state);
  return prompt;
};
var applyTag = (template, role, type, state) => {
  if (type == "pre" && tgTemplates[template][role].flag == 1 && state.systemCount == 1 && state.userCount == 1) {
    return "";
  }
  return tgTemplates[template][role][type] || "";
};
var applyRole = (template, role, content, state) => {
  if (tgTemplates[template] && tgTemplates[template][role]) {
    if (tgTemplates[template][role].flag == 2)
      return "";
    if (tgTemplates[template][role].flag == 3 && state.lastSystem && state.userCount == 1) {
      content = `${state.lastSystem}${[":", ".", "!", "?"].indexOf(state.lastSystem.slice(-1)) == -1 ? ":" : ""} ${content}`;
    }
    if (tgTemplates[template][role].template) {
      return tgTemplates[template][role].template.replaceAll("{user}", state.lastUser).replaceAll("{system}", state.lastSystem).replaceAll("{assistant}", state.lastAssistant);
    }
    return applyTag(template, role, "pre", state) + (content || "") + applyTag(template, role, "post", state);
  }
  return content || "";
};
var AiTextGeneration = class {
  modelSettings;
  inputs;
  preProcessedInputs;
  postProcessedOutputs;
  tensors;
  // run ./scripts/gen-validators.ts if you change the schema
  schema = {
    input: {
      type: "object",
      oneOf: [
        {
          properties: {
            prompt: {
              type: "string",
              maxLength: 4096
            },
            raw: {
              type: "boolean",
              default: false
            },
            stream: {
              type: "boolean",
              default: false
            },
            max_tokens: {
              type: "integer",
              default: 256
            }
          },
          required: ["prompt"]
        },
        {
          properties: {
            messages: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  role: {
                    type: "string"
                  },
                  content: {
                    type: "string",
                    maxLength: 4096
                  }
                },
                required: ["role", "content"]
              }
            },
            stream: {
              type: "boolean",
              default: false
            },
            max_tokens: {
              type: "integer",
              default: 256
            }
          },
          required: ["messages"]
        }
      ]
    },
    output: {
      oneOf: [
        {
          type: "object",
          contentType: "application/json",
          properties: {
            response: {
              type: "string"
            }
          }
        },
        {
          type: "string",
          contentType: "text/event-stream",
          format: "binary"
        }
      ]
    }
  };
  constructor(inputs, modelSettings2) {
    this.inputs = inputs;
    this.modelSettings = modelSettings2 || {
      experimental: true,
      inputsDefaultsStream: {
        max_tokens: 512
      },
      inputsDefaults: {
        max_tokens: 256
      },
      preProcessingArgs: {
        promptTemplate: "inst",
        defaultContext: ""
      }
    };
  }
  preProcessing() {
    if (this.inputs.stream && this.modelSettings.inputsDefaultsStream) {
      this.inputs = { ...this.modelSettings.inputsDefaultsStream, ...this.inputs };
    } else if (this.modelSettings.inputsDefaults) {
      this.inputs = { ...this.modelSettings.inputsDefaults, ...this.inputs };
    }
    let prompt = "";
    if (this.inputs.messages === void 0) {
      if (this.inputs.raw == true) {
        prompt = this.inputs.prompt;
      } else {
        prompt = generateTgTemplate(
          [
            { role: "system", content: this.modelSettings.preProcessingArgs.defaultContext },
            { role: "user", content: this.inputs.prompt }
          ],
          this.modelSettings.preProcessingArgs.promptTemplate
        );
      }
    } else {
      prompt = generateTgTemplate(this.inputs.messages, this.modelSettings.preProcessingArgs.promptTemplate);
    }
    this.preProcessedInputs = {
      prompt,
      max_tokens: this.inputs.max_tokens,
      stream: this.inputs.stream ? true : false
    };
  }
  generateTensors(preProcessedInputs) {
    if (this.modelSettings.generateTensorsFunc) {
      return this.modelSettings.generateTensorsFunc(preProcessedInputs);
    } else {
      return [
        new Tensor("str", [preProcessedInputs.prompt], {
          shape: [1],
          name: "INPUT_0"
        }),
        new Tensor("uint32", [preProcessedInputs.max_tokens], {
          // sequence length
          shape: [1],
          name: "INPUT_1"
        })
      ];
    }
  }
  postProcessing(response) {
    if (this.modelSettings.postProcessingFunc) {
      this.postProcessedOutputs = { response: this.modelSettings.postProcessingFunc(response, this.preProcessedInputs) };
    } else {
      this.postProcessedOutputs = { response: response.name.value[0] };
    }
  }
  postProcessingStream(response, inclen) {
    if (this.modelSettings.postProcessingFuncStream) {
      return { response: this.modelSettings.postProcessingFuncStream(response, this.preProcessedInputs, inclen) };
    } else {
      return { response: response.name.value[0] };
    }
  }
};
var AiTextClassification = class {
  modelSettings;
  inputs;
  preProcessedInputs;
  postProcessedOutputs;
  tensors;
  // run ./scripts/gen-validators.ts if you change the schema
  schema = {
    input: {
      type: "object",
      properties: {
        text: {
          type: "string"
        }
      },
      required: ["text"]
    },
    output: {
      type: "array",
      contentType: "application/json",
      items: {
        type: "object",
        properties: {
          score: {
            type: "number"
          },
          label: {
            type: "string"
          }
        }
      }
    }
  };
  constructor(inputs, modelSettings2) {
    this.inputs = inputs;
    this.modelSettings = modelSettings2;
  }
  preProcessing() {
    this.preProcessedInputs = this.inputs;
  }
  generateTensors(preProcessedInputs) {
    if (this.modelSettings.generateTensorsFunc) {
      return this.modelSettings.generateTensorsFunc(preProcessedInputs);
    } else {
      return [
        new Tensor("str", [preProcessedInputs.text], {
          shape: [1],
          name: "input_text"
        })
      ];
    }
  }
  postProcessing(response) {
    this.postProcessedOutputs = [
      {
        label: "NEGATIVE",
        score: response.logits.value[0][0]
      },
      {
        label: "POSITIVE",
        score: response.logits.value[0][1]
      }
    ];
  }
};
var AiTextEmbeddings = class {
  modelSettings;
  inputs;
  preProcessedInputs;
  postProcessedOutputs;
  tensors;
  // run ./scripts/gen-validators.ts if you change the schema
  schema = {
    input: {
      type: "object",
      properties: {
        text: {
          oneOf: [
            { type: "string" },
            {
              type: "array",
              items: {
                type: "string"
              },
              maxItems: 100
            }
          ]
        }
      },
      required: ["text"]
    },
    output: {
      type: "object",
      contentType: "application/json",
      properties: {
        shape: {
          type: "array",
          items: {
            type: "number"
          }
        },
        data: {
          type: "array",
          items: {
            type: "array",
            items: {
              type: "number"
            }
          }
        }
      }
    }
  };
  constructor(inputs, modelSettings2) {
    this.inputs = inputs;
    this.modelSettings = modelSettings2;
  }
  preProcessing() {
    this.preProcessedInputs = this.inputs;
  }
  generateTensors(preProcessedInputs) {
    if (this.modelSettings.generateTensorsFunc) {
      return this.modelSettings.generateTensorsFunc(preProcessedInputs);
    } else {
      return [
        new Tensor(
          "str",
          Array.isArray(preProcessedInputs.text) ? preProcessedInputs.text : [preProcessedInputs.text],
          {
            shape: [
              Array.isArray(preProcessedInputs.text) ? preProcessedInputs.text.length : [preProcessedInputs.text].length
            ],
            name: "input_text"
          }
        )
      ];
    }
  }
  postProcessing(response) {
    if (this.modelSettings.postProcessingFunc) {
      this.postProcessedOutputs = this.modelSettings.postProcessingFunc(response, this.preProcessedInputs);
    } else {
      this.postProcessedOutputs = {
        shape: response.embeddings.shape,
        data: response.embeddings.value
      };
    }
  }
};
var AiTranslation = class {
  modelSettings;
  inputs;
  preProcessedInputs;
  postProcessedOutputs;
  tensors;
  // run ./scripts/gen-validators.ts if you change the schema
  schema = {
    input: {
      type: "object",
      properties: {
        text: {
          type: "string"
        },
        source_lang: {
          type: "string",
          default: "en"
        },
        target_lang: {
          type: "string"
        }
      },
      required: ["text", "target_lang"]
    },
    output: {
      type: "object",
      contentType: "application/json",
      properties: {
        translated_text: {
          type: "string"
        }
      }
    }
  };
  constructor(inputs, modelSettings2) {
    this.inputs = inputs;
    this.modelSettings = modelSettings2;
  }
  preProcessing() {
    this.preProcessedInputs = this.inputs;
  }
  generateTensors(preProcessedInputs) {
    if (this.modelSettings.generateTensorsFunc) {
      return this.modelSettings.generateTensorsFunc(preProcessedInputs);
    } else {
      return [
        new Tensor("str", [preProcessedInputs.text], {
          shape: [1, 1],
          name: "text"
        }),
        new Tensor("str", [preProcessedInputs.source_lang || "en"], {
          shape: [1, 1],
          name: "source_lang"
        }),
        new Tensor("str", [preProcessedInputs.target_lang], {
          shape: [1, 1],
          name: "target_lang"
        })
      ];
    }
  }
  postProcessing(response) {
    this.postProcessedOutputs = { translated_text: response.name.value[0] };
  }
};
var AiSpeechRecognition = class {
  modelSettings;
  inputs;
  preProcessedInputs;
  postProcessedOutputs;
  tensors;
  // run ./scripts/gen-validators.ts if you change the schema
  schema = {
    input: {
      oneOf: [
        { type: "string", format: "binary" },
        {
          type: "object",
          properties: {
            audio: {
              type: "array",
              items: {
                type: "number"
              }
            }
          }
        }
      ]
    },
    output: {
      type: "object",
      contentType: "application/json",
      properties: {
        text: {
          type: "string"
        },
        word_count: {
          type: "number"
        },
        words: {
          type: "array",
          items: {
            type: "object",
            properties: {
              word: {
                type: "string"
              },
              start: {
                type: "number"
              },
              end: {
                type: "number"
              }
            }
          }
        }
      },
      required: ["text"]
    }
  };
  constructor(inputs, modelSettings2) {
    this.inputs = inputs;
    this.modelSettings = modelSettings2;
  }
  preProcessing() {
    this.preProcessedInputs = this.inputs;
  }
  generateTensors(preProcessedInputs) {
    if (this.modelSettings.generateTensorsFunc) {
      return this.modelSettings.generateTensorsFunc(preProcessedInputs);
    } else {
      return [
        new Tensor("uint8", preProcessedInputs.audio, {
          shape: [1, preProcessedInputs.audio.length],
          name: "audio"
        })
      ];
    }
  }
  postProcessing(response) {
    if (this.modelSettings.postProcessingFunc) {
      this.postProcessedOutputs = this.modelSettings.postProcessingFunc(response, this.preProcessedInputs);
    } else {
      this.postProcessedOutputs = { text: response.name.value[0].trim() };
    }
  }
};
var resnetLabels = [
  "TENCH",
  "GOLDFISH",
  "WHITE SHARK",
  "TIGER SHARK",
  "HAMMERHEAD SHARK",
  "ELECTRIC RAY",
  "STINGRAY",
  "ROOSTER",
  "HEN",
  "OSTRICH",
  "BRAMBLING",
  "GOLDFINCH",
  "HOUSE FINCH",
  "SNOWBIRD",
  "INDIGO FINCH",
  "ROBIN",
  "BULBUL",
  "JAY",
  "MAGPIE",
  "CHICKADEE",
  "WATER OUZEL",
  "KITE",
  "BALD EAGLE",
  "VULTURE",
  "GREAT GREY OWL",
  "FIRE SALAMANDER",
  "NEWT",
  "EFT",
  "SPOTTED SALAMANDER",
  "AXOLOTL",
  "BULL FROG",
  "TREE FROG",
  "TAILED FROG",
  "LOGGERHEAD",
  "LEATHERBACK TURTLE",
  "MUD TURTLE",
  "TERRAPIN",
  "BOX TURTLE",
  "BANDED GECKO",
  "COMMON IGUANA",
  "AMERICAN CHAMELEON",
  "WHIPTAIL",
  "AGAMA",
  "FRILLED LIZARD",
  "ALLIGATOR LIZARD",
  "GILA MONSTER",
  "GREEN LIZARD",
  "AFRICAN CHAMELEON",
  "KOMODO DRAGON",
  "AFRICAN CROCODILE",
  "AMERICAN ALLIGATOR",
  "TRICERATOPS",
  "THUNDER SNAKE",
  "RINGNECK SNAKE",
  "HOGNOSE SNAKE",
  "GREEN SNAKE",
  "KING SNAKE",
  "GARTER SNAKE",
  "WATER SNAKE",
  "VINE SNAKE",
  "NIGHT SNAKE",
  "BOA",
  "ROCK PYTHON",
  "COBRA",
  "GREEN MAMBA",
  "SEA SNAKE",
  "HORNED VIPER",
  "DIAMONDBACK",
  "SIDEWINDER",
  "TRILOBITE",
  "HARVESTMAN",
  "SCORPION",
  "GARDEN SPIDER",
  "BARN SPIDER",
  "GARDEN SPIDER",
  "BLACK WIDOW",
  "TARANTULA",
  "WOLF SPIDER",
  "TICK",
  "CENTIPEDE",
  "GROUSE",
  "PTARMIGAN",
  "RUFFED GROUSE",
  "PRAIRIE CHICKEN",
  "PEACOCK",
  "QUAIL",
  "PARTRIDGE",
  "AFRICAN GREY",
  "MACAW",
  "COCKATOO",
  "LORIKEET",
  "COUCAL",
  "BEE EATER",
  "HORNBILL",
  "HUMMINGBIRD",
  "JACAMAR",
  "TOUCAN",
  "DRAKE",
  "MERGANSER",
  "GOOSE",
  "BLACK SWAN",
  "TUSKER",
  "ECHIDNA",
  "PLATYPUS",
  "WALLABY",
  "KOALA",
  "WOMBAT",
  "JELLYFISH",
  "SEA ANEMONE",
  "BRAIN CORAL",
  "FLATWORM",
  "NEMATODE",
  "CONCH",
  "SNAIL",
  "SLUG",
  "SEA SLUG",
  "CHITON",
  "CHAMBERED NAUTILUS",
  "DUNGENESS CRAB",
  "ROCK CRAB",
  "FIDDLER CRAB",
  "KING CRAB",
  "AMERICAN LOBSTER",
  "SPINY LOBSTER",
  "CRAYFISH",
  "HERMIT CRAB",
  "ISOPOD",
  "WHITE STORK",
  "BLACK STORK",
  "SPOONBILL",
  "FLAMINGO",
  "LITTLE BLUE HERON",
  "AMERICAN EGRET",
  "BITTERN",
  "CRANE",
  "LIMPKIN",
  "EUROPEAN GALLINULE",
  "AMERICAN COOT",
  "BUSTARD",
  "RUDDY TURNSTONE",
  "RED-BACKED SANDPIPER",
  "REDSHANK",
  "DOWITCHER",
  "OYSTERCATCHER",
  "PELICAN",
  "KING PENGUIN",
  "ALBATROSS",
  "GREY WHALE",
  "KILLER WHALE",
  "DUGONG",
  "SEA LION",
  "CHIHUAHUA",
  "JAPANESE SPANIEL",
  "MALTESE DOG",
  "PEKINESE",
  "SHIH-TZU",
  "BLENHEIM SPANIEL",
  "PAPILLON",
  "TOY TERRIER",
  "RHODESIAN RIDGEBACK",
  "AFGHAN HOUND",
  "BASSET",
  "BEAGLE",
  "BLOODHOUND",
  "BLUETICK",
  "COONHOUND",
  "WALKER HOUND",
  "ENGLISH FOXHOUND",
  "REDBONE",
  "BORZOI",
  "IRISH WOLFHOUND",
  "ITALIAN GREYHOUND",
  "WHIPPET",
  "IBIZAN HOUND",
  "NORWEGIAN ELKHOUND",
  "OTTERHOUND",
  "SALUKI",
  "SCOTTISH DEERHOUND",
  "WEIMARANER",
  "STAFFORDSHIRE BULLTERRIER",
  "STAFFORDSHIRE TERRIER",
  "BEDLINGTON TERRIER",
  "BORDER TERRIER",
  "KERRY BLUE TERRIER",
  "IRISH TERRIER",
  "NORFOLK TERRIER",
  "NORWICH TERRIER",
  "YORKSHIRE TERRIER",
  "WIRE-HAIRED FOX TERRIER",
  "LAKELAND TERRIER",
  "SEALYHAM TERRIER",
  "AIREDALE",
  "CAIRN",
  "AUSTRALIAN TERRIER",
  "DANDIE DINMONT",
  "BOSTON BULL",
  "MINIATURE SCHNAUZER",
  "GIANT SCHNAUZER",
  "STANDARD SCHNAUZER",
  "SCOTCH TERRIER",
  "TIBETAN TERRIER",
  "SILKY TERRIER",
  "WHEATEN TERRIER",
  "WHITE TERRIER",
  "LHASA",
  "RETRIEVER",
  "CURLY-COATED RETRIEVER",
  "GOLDEN RETRIEVER",
  "LABRADOR RETRIEVER",
  "CHESAPEAKE BAY RETRIEVER",
  "SHORT-HAIRED POINTER",
  "VISLA",
  "ENGLISH SETTER",
  "IRISH SETTER",
  "GORDON SETTER",
  "BRITTANY SPANIEL",
  "CLUMBER",
  "ENGLISH SPRINGER",
  "WELSH SPRINGER SPANIEL",
  "COCKER SPANIEL",
  "SUSSEX SPANIEL",
  "IRISH WATERSPANIEL",
  "KUVASZ",
  "SCHIPPERKE",
  "GROENENDAEL",
  "MALINOIS",
  "BRIARD",
  "KELPIE",
  "KOMONDOR",
  "OLD ENGLISH SHEEPDOG",
  "SHETLAND SHEEPDOG",
  "COLLIE",
  "BORDER COLLIE",
  "BOUVIER DES FLANDRES",
  "ROTTWEILER",
  "GERMAN SHEPHERD",
  "DOBERMAN",
  "MINIATURE PINSCHER",
  "GREATER SWISS MOUNTAIN DOG",
  "BERNESE MOUNTAIN DOG",
  "APPENZELLER",
  "ENTLEBUCHER",
  "BOXER",
  "BULL MASTIFF",
  "TIBETAN MASTIFF",
  "FRENCH BULLDOG",
  "GREAT DANE",
  "SAINT BERNARD",
  "ESKIMO DOG",
  "MALAMUTE",
  "SIBERIAN HUSKY",
  "DALMATIAN",
  "AFFENPINSCHER",
  "BASENJI",
  "PUG",
  "LEONBERG",
  "NEWFOUNDLAND",
  "GREAT PYRENEES",
  "SAMOYED",
  "POMERANIAN",
  "CHOW",
  "KEESHOND",
  "BRABANCON GRIFFON",
  "PEMBROKE",
  "CARDIGAN",
  "TOY POODLE",
  "MINIATURE POODLE",
  "STANDARD POODLE",
  "MEXICAN HAIRLESS",
  "TIMBER WOLF",
  "WHITE WOLF",
  "RED WOLF",
  "COYOTE",
  "DINGO",
  "DHOLE",
  "AFRICAN HUNTING DOG",
  "HYENA",
  "RED FOX",
  "KIT FOX",
  "ARCTIC FOX",
  "GREY FOX",
  "TABBY",
  "TIGER CAT",
  "PERSIAN CAT",
  "SIAMESE CAT",
  "EGYPTIAN CAT",
  "COUGAR",
  "LYNX",
  "LEOPARD",
  "SNOW LEOPARD",
  "JAGUAR",
  "LION",
  "TIGER",
  "CHEETAH",
  "BROWN BEAR",
  "AMERICAN BLACK BEAR",
  "ICE BEAR",
  "SLOTH BEAR",
  "MONGOOSE",
  "MEERKAT",
  "TIGER BEETLE",
  "LADYBUG",
  "GROUND BEETLE",
  "LONG-HORNED BEETLE",
  "LEAF BEETLE",
  "DUNG BEETLE",
  "RHINOCEROS BEETLE",
  "WEEVIL",
  "FLY",
  "BEE",
  "ANT",
  "GRASSHOPPER",
  "CRICKET",
  "WALKING STICK",
  "COCKROACH",
  "MANTIS",
  "CICADA",
  "LEAFHOPPER",
  "LACEWING",
  "DRAGONFLY",
  "DAMSELFLY",
  "ADMIRAL",
  "RINGLET",
  "MONARCH",
  "CABBAGE BUTTERFLY",
  "SULPHUR BUTTERFLY",
  "LYCAENID",
  "STARFISH",
  "SEA URCHIN",
  "SEA CUCUMBER",
  "WOOD RABBIT",
  "HARE",
  "ANGORA",
  "HAMSTER",
  "PORCUPINE",
  "FOX SQUIRREL",
  "MARMOT",
  "BEAVER",
  "GUINEA PIG",
  "SORREL",
  "ZEBRA",
  "HOG",
  "WILD BOAR",
  "WARTHOG",
  "HIPPOPOTAMUS",
  "OX",
  "WATER BUFFALO",
  "BISON",
  "RAM",
  "BIGHORN",
  "IBEX",
  "HARTEBEEST",
  "IMPALA",
  "GAZELLE",
  "ARABIAN CAMEL",
  "LLAMA",
  "WEASEL",
  "MINK",
  "POLECAT",
  "BLACK-FOOTED FERRET",
  "OTTER",
  "SKUNK",
  "BADGER",
  "ARMADILLO",
  "THREE-TOED SLOTH",
  "ORANGUTAN",
  "GORILLA",
  "CHIMPANZEE",
  "GIBBON",
  "SIAMANG",
  "GUENON",
  "PATAS",
  "BABOON",
  "MACAQUE",
  "LANGUR",
  "COLOBUS",
  "PROBOSCIS MONKEY",
  "MARMOSET",
  "CAPUCHIN",
  "HOWLER MONKEY",
  "TITI",
  "SPIDER MONKEY",
  "SQUIRREL MONKEY",
  "MADAGASCAR CAT",
  "INDRI",
  "INDIAN ELEPHANT",
  "AFRICAN ELEPHANT",
  "LESSER PANDA",
  "GIANT PANDA",
  "BARRACOUTA",
  "EEL",
  "COHO",
  "ROCK BEAUTY",
  "ANEMONE FISH",
  "STURGEON",
  "GAR",
  "LIONFISH",
  "PUFFER",
  "ABACUS",
  "ABAYA",
  "ACADEMIC GOWN",
  "ACCORDION",
  "ACOUSTIC GUITAR",
  "AIRCRAFT CARRIER",
  "AIRLINER",
  "AIRSHIP",
  "ALTAR",
  "AMBULANCE",
  "AMPHIBIAN",
  "ANALOG CLOCK",
  "APIARY",
  "APRON",
  "ASHCAN",
  "ASSAULT RIFLE",
  "BACKPACK",
  "BAKERY",
  "BALANCE BEAM",
  "BALLOON",
  "BALLPOINT",
  "BAND AID",
  "BANJO",
  "BANNISTER",
  "BARBELL",
  "BARBER CHAIR",
  "BARBERSHOP",
  "BARN",
  "BAROMETER",
  "BARREL",
  "BARROW",
  "BASEBALL",
  "BASKETBALL",
  "BASSINET",
  "BASSOON",
  "BATHING CAP",
  "BATH TOWEL",
  "BATHTUB",
  "BEACH WAGON",
  "BEACON",
  "BEAKER",
  "BEARSKIN",
  "BEER BOTTLE",
  "BEER GLASS",
  "BELL COTE",
  "BIB",
  "BICYCLE-BUILT-FOR-TWO",
  "BIKINI",
  "BINDER",
  "BINOCULARS",
  "BIRDHOUSE",
  "BOATHOUSE",
  "BOBSLED",
  "BOLO TIE",
  "BONNET",
  "BOOKCASE",
  "BOOKSHOP",
  "BOTTLECAP",
  "BOW",
  "BOW TIE",
  "BRASS",
  "BRASSIERE",
  "BREAKWATER",
  "BREASTPLATE",
  "BROOM",
  "BUCKET",
  "BUCKLE",
  "BULLETPROOF VEST",
  "BULLET TRAIN",
  "BUTCHER SHOP",
  "CAB",
  "CALDRON",
  "CANDLE",
  "CANNON",
  "CANOE",
  "CAN OPENER",
  "CARDIGAN",
  "CAR MIRROR",
  "CAROUSEL",
  "CARPENTERS KIT",
  "CARTON",
  "CAR WHEEL",
  "CASH MACHINE",
  "CASSETTE",
  "CASSETTE PLAYER",
  "CASTLE",
  "CATAMARAN",
  "CD PLAYER",
  "CELLO",
  "CELLULAR TELEPHONE",
  "CHAIN",
  "CHAINLINK FENCE",
  "CHAIN MAIL",
  "CHAIN SAW",
  "CHEST",
  "CHIFFONIER",
  "CHIME",
  "CHINA CABINET",
  "CHRISTMAS STOCKING",
  "CHURCH",
  "CINEMA",
  "CLEAVER",
  "CLIFF DWELLING",
  "CLOAK",
  "CLOG",
  "COCKTAIL SHAKER",
  "COFFEE MUG",
  "COFFEEPOT",
  "COIL",
  "COMBINATION LOCK",
  "COMPUTER KEYBOARD",
  "CONFECTIONERY",
  "CONTAINER SHIP",
  "CONVERTIBLE",
  "CORKSCREW",
  "CORNET",
  "COWBOY BOOT",
  "COWBOY HAT",
  "CRADLE",
  "CRANE",
  "CRASH HELMET",
  "CRATE",
  "CRIB",
  "CROCK POT",
  "CROQUET BALL",
  "CRUTCH",
  "CUIRASS",
  "DAM",
  "DESK",
  "DESKTOP COMPUTER",
  "DIAL TELEPHONE",
  "DIAPER",
  "DIGITAL CLOCK",
  "DIGITAL WATCH",
  "DINING TABLE",
  "DISHRAG",
  "DISHWASHER",
  "DISK BRAKE",
  "DOCK",
  "DOGSLED",
  "DOME",
  "DOORMAT",
  "DRILLING PLATFORM",
  "DRUM",
  "DRUMSTICK",
  "DUMBBELL",
  "DUTCH OVEN",
  "ELECTRIC FAN",
  "ELECTRIC GUITAR",
  "ELECTRIC LOCOMOTIVE",
  "ENTERTAINMENT CENTER",
  "ENVELOPE",
  "ESPRESSO MAKER",
  "FACE POWDER",
  "FEATHER BOA",
  "FILE",
  "FIREBOAT",
  "FIRE ENGINE",
  "FIRE SCREEN",
  "FLAGPOLE",
  "FLUTE",
  "FOLDING CHAIR",
  "FOOTBALL HELMET",
  "FORKLIFT",
  "FOUNTAIN",
  "FOUNTAIN PEN",
  "FOUR-POSTER",
  "FREIGHT CAR",
  "FRENCH HORN",
  "FRYING PAN",
  "FUR COAT",
  "GARBAGE TRUCK",
  "GASMASK",
  "GAS PUMP",
  "GOBLET",
  "GO-KART",
  "GOLF BALL",
  "GOLFCART",
  "GONDOLA",
  "GONG",
  "GOWN",
  "GRAND PIANO",
  "GREENHOUSE",
  "GRILLE",
  "GROCERY STORE",
  "GUILLOTINE",
  "HAIR SLIDE",
  "HAIR SPRAY",
  "HALF TRACK",
  "HAMMER",
  "HAMPER",
  "HAND BLOWER",
  "HAND-HELD COMPUTER",
  "HANDKERCHIEF",
  "HARD DISC",
  "HARMONICA",
  "HARP",
  "HARVESTER",
  "HATCHET",
  "HOLSTER",
  "HOME THEATER",
  "HONEYCOMB",
  "HOOK",
  "HOOPSKIRT",
  "HORIZONTAL BAR",
  "HORSE CART",
  "HOURGLASS",
  "IPOD",
  "IRON",
  "JACK-O-LANTERN",
  "JEAN",
  "JEEP",
  "JERSEY",
  "JIGSAW PUZZLE",
  "JINRIKISHA",
  "JOYSTICK",
  "KIMONO",
  "KNEE PAD",
  "KNOT",
  "LAB COAT",
  "LADLE",
  "LAMPSHADE",
  "LAPTOP",
  "LAWN MOWER",
  "LENS CAP",
  "LETTER OPENER",
  "LIBRARY",
  "LIFEBOAT",
  "LIGHTER",
  "LIMOUSINE",
  "LINER",
  "LIPSTICK",
  "LOAFER",
  "LOTION",
  "LOUDSPEAKER",
  "LOUPE",
  "LUMBERMILL",
  "MAGNETIC COMPASS",
  "MAILBAG",
  "MAILBOX",
  "MAILLOT",
  "MAILLOT",
  "MANHOLE COVER",
  "MARACA",
  "MARIMBA",
  "MASK",
  "MATCHSTICK",
  "MAYPOLE",
  "MAZE",
  "MEASURING CUP",
  "MEDICINE CHEST",
  "MEGALITH",
  "MICROPHONE",
  "MICROWAVE",
  "MILITARY UNIFORM",
  "MILK CAN",
  "MINIBUS",
  "MINISKIRT",
  "MINIVAN",
  "MISSILE",
  "MITTEN",
  "MIXING BOWL",
  "MOBILE HOME",
  "MODEL T",
  "MODEM",
  "MONASTERY",
  "MONITOR",
  "MOPED",
  "MORTAR",
  "MORTARBOARD",
  "MOSQUE",
  "MOSQUITO NET",
  "MOTOR SCOOTER",
  "MOUNTAIN BIKE",
  "MOUNTAIN TENT",
  "MOUSE",
  "MOUSETRAP",
  "MOVING VAN",
  "MUZZLE",
  "NAIL",
  "NECK BRACE",
  "NECKLACE",
  "NIPPLE",
  "NOTEBOOK",
  "OBELISK",
  "OBOE",
  "OCARINA",
  "ODOMETER",
  "OIL FILTER",
  "ORGAN",
  "OSCILLOSCOPE",
  "OVERSKIRT",
  "OXCART",
  "OXYGEN MASK",
  "PACKET",
  "PADDLE",
  "PADDLEWHEEL",
  "PADLOCK",
  "PAINTBRUSH",
  "PAJAMA",
  "PALACE",
  "PANPIPE",
  "PAPER TOWEL",
  "PARACHUTE",
  "PARALLEL BARS",
  "PARK BENCH",
  "PARKING METER",
  "PASSENGER CAR",
  "PATIO",
  "PAY-PHONE",
  "PEDESTAL",
  "PENCIL BOX",
  "PENCIL SHARPENER",
  "PERFUME",
  "PETRI DISH",
  "PHOTOCOPIER",
  "PICK",
  "PICKELHAUBE",
  "PICKET FENCE",
  "PICKUP",
  "PIER",
  "PIGGY BANK",
  "PILL BOTTLE",
  "PILLOW",
  "PING-PONG BALL",
  "PINWHEEL",
  "PIRATE",
  "PITCHER",
  "PLANE",
  "PLANETARIUM",
  "PLASTIC BAG",
  "PLATE RACK",
  "PLOW",
  "PLUNGER",
  "POLAROID CAMERA",
  "POLE",
  "POLICE VAN",
  "PONCHO",
  "POOL TABLE",
  "POP BOTTLE",
  "POT",
  "POTTERS WHEEL",
  "POWER DRILL",
  "PRAYER RUG",
  "PRINTER",
  "PRISON",
  "PROJECTILE",
  "PROJECTOR",
  "PUCK",
  "PUNCHING BAG",
  "PURSE",
  "QUILL",
  "QUILT",
  "RACER",
  "RACKET",
  "RADIATOR",
  "RADIO",
  "RADIO TELESCOPE",
  "RAIN BARREL",
  "RECREATIONAL VEHICLE",
  "REEL",
  "REFLEX CAMERA",
  "REFRIGERATOR",
  "REMOTE CONTROL",
  "RESTAURANT",
  "REVOLVER",
  "RIFLE",
  "ROCKING CHAIR",
  "ROTISSERIE",
  "RUBBER ERASER",
  "RUGBY BALL",
  "RULE",
  "RUNNING SHOE",
  "SAFE",
  "SAFETY PIN",
  "SALTSHAKER",
  "SANDAL",
  "SARONG",
  "SAX",
  "SCABBARD",
  "SCALE",
  "SCHOOL BUS",
  "SCHOONER",
  "SCOREBOARD",
  "SCREEN",
  "SCREW",
  "SCREWDRIVER",
  "SEAT BELT",
  "SEWING MACHINE",
  "SHIELD",
  "SHOE SHOP",
  "SHOJI",
  "SHOPPING BASKET",
  "SHOPPING CART",
  "SHOVEL",
  "SHOWER CAP",
  "SHOWER CURTAIN",
  "SKI",
  "SKI MASK",
  "SLEEPING BAG",
  "SLIDE RULE",
  "SLIDING DOOR",
  "SLOT",
  "SNORKEL",
  "SNOWMOBILE",
  "SNOWPLOW",
  "SOAP DISPENSER",
  "SOCCER BALL",
  "SOCK",
  "SOLAR DISH",
  "SOMBRERO",
  "SOUP BOWL",
  "SPACE BAR",
  "SPACE HEATER",
  "SPACE SHUTTLE",
  "SPATULA",
  "SPEEDBOAT",
  "SPIDER WEB",
  "SPINDLE",
  "SPORTS CAR",
  "SPOTLIGHT",
  "STAGE",
  "STEAM LOCOMOTIVE",
  "STEEL ARCH BRIDGE",
  "STEEL DRUM",
  "STETHOSCOPE",
  "STOLE",
  "STONE WALL",
  "STOPWATCH",
  "STOVE",
  "STRAINER",
  "STREETCAR",
  "STRETCHER",
  "STUDIO COUCH",
  "STUPA",
  "SUBMARINE",
  "SUIT",
  "SUNDIAL",
  "SUNGLASS",
  "SUNGLASSES",
  "SUNSCREEN",
  "SUSPENSION BRIDGE",
  "SWAB",
  "SWEATSHIRT",
  "SWIMMING TRUNKS",
  "SWING",
  "SWITCH",
  "SYRINGE",
  "TABLE LAMP",
  "TANK",
  "TAPE PLAYER",
  "TEAPOT",
  "TEDDY",
  "TELEVISION",
  "TENNIS BALL",
  "THATCH",
  "THEATER CURTAIN",
  "THIMBLE",
  "THRESHER",
  "THRONE",
  "TILE ROOF",
  "TOASTER",
  "TOBACCO SHOP",
  "TOILET SEAT",
  "TORCH",
  "TOTEM POLE",
  "TOW TRUCK",
  "TOYSHOP",
  "TRACTOR",
  "TRAILER TRUCK",
  "TRAY",
  "TRENCH COAT",
  "TRICYCLE",
  "TRIMARAN",
  "TRIPOD",
  "TRIUMPHAL ARCH",
  "TROLLEYBUS",
  "TROMBONE",
  "TUB",
  "TURNSTILE",
  "TYPEWRITER KEYBOARD",
  "UMBRELLA",
  "UNICYCLE",
  "UPRIGHT",
  "VACUUM",
  "VASE",
  "VAULT",
  "VELVET",
  "VENDING MACHINE",
  "VESTMENT",
  "VIADUCT",
  "VIOLIN",
  "VOLLEYBALL",
  "WAFFLE IRON",
  "WALL CLOCK",
  "WALLET",
  "WARDROBE",
  "WARPLANE",
  "WASHBASIN",
  "WASHER",
  "WATER BOTTLE",
  "WATER JUG",
  "WATER TOWER",
  "WHISKEY JUG",
  "WHISTLE",
  "WIG",
  "WINDOW SCREEN",
  "WINDOW SHADE",
  "WINDSOR TIE",
  "WINE BOTTLE",
  "WING",
  "WOK",
  "WOODEN SPOON",
  "WOOL",
  "WORM FENCE",
  "WRECK",
  "YAWL",
  "YURT",
  "WEB SITE",
  "COMIC BOOK",
  "CROSSWORD PUZZLE",
  "STREET SIGN",
  "TRAFFIC LIGHT",
  "BOOK JACKET",
  "MENU",
  "PLATE",
  "GUACAMOLE",
  "CONSOMME",
  "HOT POT",
  "TRIFLE",
  "ICE CREAM",
  "ICE LOLLY",
  "FRENCH LOAF",
  "BAGEL",
  "PRETZEL",
  "CHEESEBURGER",
  "HOTDOG",
  "MASHED POTATO",
  "HEAD CABBAGE",
  "BROCCOLI",
  "CAULIFLOWER",
  "ZUCCHINI",
  "SPAGHETTI SQUASH",
  "ACORN SQUASH",
  "BUTTERNUT SQUASH",
  "CUCUMBER",
  "ARTICHOKE",
  "BELL PEPPER",
  "CARDOON",
  "MUSHROOM",
  "GRANNY SMITH",
  "STRAWBERRY",
  "ORANGE",
  "LEMON",
  "FIG",
  "PINEAPPLE",
  "BANANA",
  "JACKFRUIT",
  "CUSTARD APPLE",
  "POMEGRANATE",
  "HAY",
  "CARBONARA",
  "CHOCOLATE SAUCE",
  "DOUGH",
  "MEAT LOAF",
  "PIZZA",
  "POTPIE",
  "BURRITO",
  "RED WINE",
  "ESPRESSO",
  "CUP",
  "EGGNOG",
  "ALP",
  "BUBBLE",
  "CLIFF",
  "CORAL REEF",
  "GEYSER",
  "LAKESIDE",
  "PROMONTORY",
  "SANDBAR",
  "SEASHORE",
  "VALLEY",
  "VOLCANO",
  "BALLPLAYER",
  "GROOM",
  "SCUBA DIVER",
  "RAPESEED",
  "DAISY",
  "LADY SLIPPER",
  "CORN",
  "ACORN",
  "HIP",
  "BUCKEYE",
  "CORAL FUNGUS",
  "AGARIC",
  "GYROMITRA",
  "STINKHORN",
  "EARTHSTAR",
  "HEN-OF-THE-WOODS",
  "BOLETE",
  "EAR",
  "TOILET TISSUE"
];
var AiImageClassification = class {
  modelSettings;
  inputs;
  preProcessedInputs;
  postProcessedOutputs;
  tensors;
  // run ./scripts/gen-validators.ts if you change the schema
  schema = {
    input: {
      oneOf: [
        { type: "string", format: "binary" },
        {
          type: "object",
          properties: {
            image: {
              type: "array",
              items: {
                type: "number"
              }
            }
          }
        }
      ]
    },
    output: {
      type: "array",
      contentType: "application/json",
      items: {
        type: "object",
        properties: {
          score: {
            type: "number"
          },
          label: {
            type: "string"
          }
        }
      }
    }
  };
  constructor(inputs, modelSettings2) {
    this.inputs = inputs;
    this.modelSettings = modelSettings2;
  }
  preProcessing() {
    this.preProcessedInputs = this.inputs;
  }
  generateTensors(preProcessedInputs) {
    if (this.modelSettings.generateTensorsFunc) {
      return this.modelSettings.generateTensorsFunc(preProcessedInputs);
    } else {
      return [
        new Tensor("uint8", preProcessedInputs.image, {
          shape: [1, preProcessedInputs.image.length],
          name: "input"
        })
      ];
    }
  }
  postProcessing(response) {
    const labels = [];
    const scores = response.output.value[0];
    for (var s in scores)
      labels.push({ label: resnetLabels[s], score: scores[s] });
    labels.sort((a, b) => {
      return b.score - a.score;
    });
    this.postProcessedOutputs = labels.slice(0, 5);
  }
};
var AiImageToText = class {
  modelSettings;
  inputs;
  preProcessedInputs;
  postProcessedOutputs;
  tensors;
  // run ./scripts/gen-validators.ts if you change the schema
  schema = {
    input: {
      oneOf: [
        { type: "string", format: "binary" },
        {
          type: "object",
          properties: {
            image: {
              type: "array",
              items: {
                type: "number"
              }
            },
            prompt: {
              type: "string"
            },
            max_tokens: {
              type: "integer",
              default: 512
            }
          }
        }
      ]
    },
    output: {
      type: "object",
      contentType: "application/json",
      properties: {
        description: {
          type: "string"
        }
      }
    }
  };
  constructor(inputs, modelSettings2) {
    this.inputs = inputs;
    this.modelSettings = modelSettings2;
  }
  preProcessing() {
    this.preProcessedInputs = this.inputs;
  }
  generateTensors(preProcessedInputs) {
    if (this.modelSettings.generateTensorsFunc) {
      return this.modelSettings.generateTensorsFunc(preProcessedInputs);
    } else {
      return [
        new Tensor(
          "int32",
          [
            preProcessedInputs.max_tokens || this.schema.input.oneOf.filter((f) => f.type == "object")[0].properties.max_tokens.default
          ],
          {
            shape: [1],
            name: "max_tokens"
          }
        ),
        new Tensor("str", [preProcessedInputs.prompt], {
          shape: [1],
          name: "prompt"
        }),
        new Tensor("uint8", preProcessedInputs.image, {
          shape: [1, preProcessedInputs.image.length],
          name: "image"
        })
      ];
    }
  }
  postProcessing(response) {
    if (this.modelSettings.postProcessingFunc) {
      this.postProcessedOutputs = {
        description: this.modelSettings.postProcessingFunc(response, this.preProcessedInputs)
      };
    } else {
      this.postProcessedOutputs = { description: response.name.value[0] };
    }
  }
};
var AiObjectDetection = class {
  modelSettings;
  inputs;
  preProcessedInputs;
  postProcessedOutputs;
  tensors;
  // run ./scripts/gen-validators.ts if you change the schema
  schema = {
    input: {
      oneOf: [
        { type: "string", format: "binary" },
        {
          type: "object",
          properties: {
            image: {
              type: "array",
              items: {
                type: "number"
              }
            }
          }
        }
      ]
    },
    output: {
      type: "array",
      contentType: "application/json",
      items: {
        type: "object",
        properties: {
          score: {
            type: "number"
          },
          label: {
            type: "string"
          },
          box: {
            type: "object",
            properties: {
              xmin: {
                type: "number"
              },
              ymin: {
                type: "number"
              },
              xmax: {
                type: "number"
              },
              ymax: {
                type: "number"
              }
            }
          }
        }
      }
    }
  };
  constructor(inputs, modelSettings2) {
    this.inputs = inputs;
    this.modelSettings = modelSettings2;
  }
  preProcessing() {
    this.preProcessedInputs = this.inputs;
  }
  generateTensors(preProcessedInputs) {
    if (this.modelSettings.generateTensorsFunc) {
      return this.modelSettings.generateTensorsFunc(preProcessedInputs);
    } else {
      return [
        new Tensor("uint8", preProcessedInputs.image, {
          shape: [1, preProcessedInputs.image.length],
          name: "input"
        })
      ];
    }
  }
  postProcessing(response) {
    const scores = response.scores.value[0].map((score, i) => {
      return {
        score,
        label: response.name.value[response.labels.value[0][i]],
        box: {
          xmin: response.boxes.value[0][i][0],
          ymin: response.boxes.value[0][i][1],
          xmax: response.boxes.value[0][i][2],
          ymax: response.boxes.value[0][i][3]
        }
      };
    });
    this.postProcessedOutputs = scores.sort((a, b) => {
      return b.score - a.score;
    });
  }
};
var AiTextToImage = class {
  modelSettings;
  inputs;
  preProcessedInputs;
  postProcessedOutputs;
  tensors;
  // run ./scripts/gen-validators.ts if you change the schema
  schema = {
    input: {
      type: "object",
      properties: {
        prompt: {
          type: "string"
        },
        image: {
          oneOf: [
            { type: "string", format: "binary" },
            {
              type: "object",
              properties: {
                image: {
                  type: "array",
                  items: {
                    type: "number"
                  }
                }
              }
            }
          ]
        },
        mask: {
          oneOf: [
            { type: "string", format: "binary" },
            {
              type: "object",
              properties: {
                mask: {
                  type: "array",
                  items: {
                    type: "number"
                  }
                }
              }
            }
          ]
        },
        num_steps: {
          type: "integer",
          default: 20,
          maximum: 20
        },
        strength: {
          type: "number",
          default: 1
        },
        guidance: {
          type: "number",
          default: 7.5
        }
      },
      required: ["prompt"]
    },
    output: {
      type: "string",
      contentType: "image/png",
      format: "binary"
    }
  };
  constructor(inputs, modelSettings2) {
    this.inputs = inputs;
    this.modelSettings = modelSettings2;
  }
  preProcessing() {
    this.preProcessedInputs = this.inputs;
  }
  generateTensors(preProcessedInputs) {
    if (this.modelSettings.generateTensorsFunc) {
      return this.modelSettings.generateTensorsFunc(preProcessedInputs);
    } else {
      let tokens = [
        new Tensor("str", [preProcessedInputs.prompt], {
          shape: [1],
          name: "input_text"
        }),
        new Tensor("int32", [preProcessedInputs.num_steps || this.schema.input.properties.num_steps.default], {
          shape: [1],
          name: "num_steps"
        })
      ];
      if (preProcessedInputs.image) {
        tokens = [
          ...tokens,
          ...[
            new Tensor("str", [""], {
              shape: [1],
              name: "negative_prompt"
            }),
            new Tensor(
              "float32",
              [preProcessedInputs.strength || this.schema.input.properties.strength.default],
              {
                shape: [1],
                name: "strength"
              }
            ),
            new Tensor(
              "float32",
              [preProcessedInputs.guidance || this.schema.input.properties.guidance.default],
              {
                shape: [1],
                name: "guidance"
              }
            ),
            new Tensor("uint8", preProcessedInputs.image, {
              shape: [1, preProcessedInputs.image.length],
              name: "image"
            })
          ]
        ];
      }
      if (preProcessedInputs.mask) {
        tokens = [
          ...tokens,
          ...[
            new Tensor("uint8", preProcessedInputs.mask, {
              shape: [1, preProcessedInputs.mask.length],
              name: "mask_image"
            })
          ]
        ];
      }
      return tokens;
    }
  }
  OldgenerateTensors(preProcessedInputs) {
    if (this.modelSettings.generateTensorsFunc) {
      return this.modelSettings.generateTensorsFunc(preProcessedInputs);
    } else {
      if (preProcessedInputs.image && preProcessedInputs.mask) {
        return [
          new Tensor("str", [preProcessedInputs.prompt], {
            shape: [1],
            name: "input_text"
          }),
          new Tensor("str", [""], {
            shape: [1],
            name: "negative_prompt"
          }),
          new Tensor("int32", [preProcessedInputs.num_steps || 20], {
            shape: [1],
            name: "num_steps"
          }),
          new Tensor("float32", [preProcessedInputs.strength || 1], {
            shape: [1],
            name: "strength"
          }),
          new Tensor("float32", [preProcessedInputs.guidance || 7.5], {
            shape: [1],
            name: "guidance"
          }),
          new Tensor("uint8", preProcessedInputs.image, {
            shape: [1, preProcessedInputs.image.length],
            name: "image"
          }),
          new Tensor("uint8", preProcessedInputs.mask, {
            shape: [1, preProcessedInputs.mask.length],
            name: "mask_image"
          })
        ];
      } else if (preProcessedInputs.image) {
        return [
          new Tensor("str", [preProcessedInputs.prompt], {
            shape: [1],
            name: "input_text"
          }),
          new Tensor("str", [""], {
            shape: [1],
            name: "negative_prompt"
          }),
          new Tensor("float32", [preProcessedInputs.strength || 1], {
            shape: [1],
            name: "strength"
          }),
          new Tensor("float32", [preProcessedInputs.guidance || 7.5], {
            shape: [1],
            name: "guidance"
          }),
          new Tensor("uint8", preProcessedInputs.image, {
            shape: [1, preProcessedInputs.image.length],
            name: "image"
          }),
          new Tensor("int32", [preProcessedInputs.num_steps || 20], {
            shape: [1],
            name: "num_steps"
          })
        ];
      } else {
        return [
          new Tensor("str", [preProcessedInputs.prompt], {
            shape: [1],
            name: "input_text"
          }),
          new Tensor("int32", [preProcessedInputs.num_steps || 20], {
            shape: [1],
            name: "num_steps"
          })
        ];
      }
    }
  }
  postProcessing(response) {
    this.postProcessedOutputs = new Uint8Array(response.output_image.value);
  }
};
var AiSentenceSimilarity = class {
  modelSettings;
  inputs;
  preProcessedInputs;
  postProcessedOutputs;
  tensors;
  // run ./scripts/gen-validators.ts if you change the schema
  schema = {
    input: {
      type: "object",
      properties: {
        source: {
          type: "string"
        },
        sentences: {
          type: "array",
          items: {
            type: "string"
          }
        }
      },
      required: ["source", "sentences"]
    },
    output: {
      type: "array",
      contentType: "application/json",
      items: {
        type: "number"
      }
    }
  };
  constructor(inputs, modelSettings2) {
    this.inputs = inputs;
    this.modelSettings = modelSettings2;
  }
  preProcessing() {
    this.preProcessedInputs = this.inputs;
  }
  generateTensors(preProcessedInputs) {
    if (this.modelSettings.generateTensorsFunc) {
      return this.modelSettings.generateTensorsFunc(preProcessedInputs);
    } else {
      return [
        new Tensor("str", [preProcessedInputs.source], {
          shape: [1],
          name: "source_sentence"
        }),
        new Tensor("str", preProcessedInputs.sentences, {
          shape: [preProcessedInputs.sentences.length],
          name: "sentences"
        })
      ];
    }
  }
  postProcessing(response) {
    this.postProcessedOutputs = response.scores.value;
  }
};
var AiSummarization = class {
  modelSettings;
  inputs;
  preProcessedInputs;
  postProcessedOutputs;
  tensors;
  // run ./scripts/gen-validators.ts if you change the schema
  schema = {
    input: {
      type: "object",
      properties: {
        input_text: {
          type: "string"
        },
        max_length: {
          type: "integer",
          default: 1024
        }
      },
      required: ["input_text"]
    },
    output: {
      type: "object",
      contentType: "application/json",
      properties: {
        summary: {
          type: "string"
        }
      }
    }
  };
  constructor(inputs, modelSettings2) {
    this.inputs = inputs;
    this.modelSettings = modelSettings2;
  }
  preProcessing() {
    this.preProcessedInputs = this.inputs;
  }
  generateTensors(preProcessedInputs) {
    if (this.modelSettings.generateTensorsFunc) {
      return this.modelSettings.generateTensorsFunc(preProcessedInputs);
    } else {
      return [
        new Tensor("int32", [preProcessedInputs.max_length || this.schema.input.properties.max_length.default], {
          // sequence length
          shape: [1],
          name: "max_length"
        }),
        new Tensor("str", [preProcessedInputs.input_text], {
          shape: [1],
          name: "input_text"
        })
      ];
    }
  }
  postProcessing(response) {
    this.postProcessedOutputs = { summary: response.name.value[0] };
  }
};
var chatDefaultContext = "A chat between a curious human and an artificial intelligence assistant. The assistant gives helpful, detailed, and polite answers to the human's questions.";
var codeDefaultContext = "Write code to solve the following coding problem that obeys the constraints and passes the example test cases. Please wrap your code answer using   ```:";
var vLLMGenerateTensors = (preProcessedInputs) => {
  const tensors = [
    new Tensor("str", [preProcessedInputs.prompt], {
      shape: [1],
      name: "text_input"
    }),
    new Tensor("str", [`{"max_tokens": ${preProcessedInputs.max_tokens}}`], {
      // sequence length
      shape: [1],
      name: "sampling_parameters"
    })
  ];
  if (preProcessedInputs.stream) {
    tensors.push(
      new Tensor("bool", true, {
        name: "stream"
      })
    );
  }
  return tensors;
};
var tgiPostProc = (response, ignoreTokens) => {
  let r = response["generated_text"].value[0];
  if (ignoreTokens) {
    for (var i in ignoreTokens)
      r = r.replace(ignoreTokens[i], "");
  }
  return r;
};
var defaultvLLM = {
  type: "vllm",
  inputsDefaultsStream: {
    max_tokens: 512
  },
  inputsDefaults: {
    max_tokens: 512
  },
  preProcessingArgs: {
    promptTemplate: "bare",
    defaultContext: ""
  },
  generateTensorsFunc: (preProcessedInputs) => vLLMGenerateTensors(preProcessedInputs),
  postProcessingFunc: (r, inputs) => r["name"].value[0].slice(inputs.prompt.length),
  postProcessingFuncStream: (r, inputs, inclen) => {
    let token = r["name"].value[0];
    let len = inclen(token.length);
    let lastLen = len - token.length;
    if (len < inputs.prompt.length)
      return;
    if (lastLen >= inputs.prompt.length)
      return token;
    return token.slice(inputs.prompt.length - lastLen);
  }
};
var defaultTGI = (promptTemplate, defaultContext, ignoreTokens) => {
  return {
    type: "tgi",
    inputsDefaultsStream: {
      max_tokens: 512
    },
    inputsDefaults: {
      max_tokens: 256
    },
    preProcessingArgs: {
      promptTemplate,
      defaultContext
    },
    postProcessingFunc: (r, inputs) => tgiPostProc(r, ignoreTokens),
    postProcessingFuncStream: (r, inputs, len) => tgiPostProc(r, ignoreTokens)
  };
};
var modelMappings = {
  "text-classification": {
    models: ["@cf/huggingface/distilbert-sst-2-int8", "@cf/jpmorganchase/roberta-spam"],
    class: AiTextClassification,
    id: "19606750-23ed-4371-aab2-c20349b53a60"
  },
  "text-to-image": {
    models: [
      "@cf/stabilityai/stable-diffusion-xl-base-1.0",
      "@cf/runwayml/stable-diffusion-v1-5-inpainting",
      "@cf/runwayml/stable-diffusion-v1-5-img2img",
      "@cf/lykon/dreamshaper-8-lcm",
      "@cf/bytedance/stable-diffusion-xl-lightning"
    ],
    class: AiTextToImage,
    id: "3d6e1f35-341b-4915-a6c8-9a7142a9033a"
  },
  "sentence-similarity": {
    models: ["@hf/sentence-transformers/all-minilm-l6-v2"],
    class: AiSentenceSimilarity,
    id: "69bf4e84-441e-401a-bdfc-256fd54d0fff"
  },
  "text-embeddings": {
    models: [
      "@cf/baai/bge-small-en-v1.5",
      "@cf/baai/bge-base-en-v1.5",
      "@cf/baai/bge-large-en-v1.5",
      "@hf/baai/bge-base-en-v1.5"
    ],
    class: AiTextEmbeddings,
    id: "0137cdcf-162a-4108-94f2-1ca59e8c65ee"
  },
  "speech-recognition": {
    models: ["@cf/openai/whisper"],
    class: AiSpeechRecognition,
    id: "dfce1c48-2a81-462e-a7fd-de97ce985207"
  },
  "image-classification": {
    models: ["@cf/microsoft/resnet-50"],
    class: AiImageClassification,
    id: "00cd182b-bf30-4fc4-8481-84a3ab349657"
  },
  "object-detection": {
    models: ["@cf/facebook/detr-resnet-50"],
    class: AiObjectDetection,
    id: "9c178979-90d9-49d8-9e2c-0f1cf01815d4"
  },
  "text-generation": {
    models: [
      "@cf/meta/llama-2-7b-chat-int8",
      "@cf/mistral/mistral-7b-instruct-v0.1",
      "@cf/meta/llama-2-7b-chat-fp16",
      "@hf/thebloke/llama-2-13b-chat-awq",
      "@hf/thebloke/zephyr-7b-beta-awq",
      "@hf/thebloke/mistral-7b-instruct-v0.1-awq",
      "@hf/thebloke/codellama-7b-instruct-awq",
      "@hf/thebloke/openchat_3.5-awq",
      "@hf/thebloke/openhermes-2.5-mistral-7b-awq",
      "@hf/thebloke/starling-lm-7b-alpha-awq",
      "@hf/thebloke/orca-2-13b-awq",
      "@hf/thebloke/neural-chat-7b-v3-1-awq",
      "@hf/thebloke/llamaguard-7b-awq",
      "@hf/thebloke/deepseek-coder-6.7b-base-awq",
      "@hf/thebloke/deepseek-coder-6.7b-instruct-awq",
      "@cf/deepseek-ai/deepseek-math-7b-base",
      "@cf/deepseek-ai/deepseek-math-7b-instruct",
      "@cf/defog/sqlcoder-7b-2",
      "@cf/openchat/openchat-3.5-0106",
      "@cf/tiiuae/falcon-7b-instruct",
      "@cf/thebloke/discolm-german-7b-v1-awq",
      "@cf/qwen/qwen1.5-0.5b-chat",
      "@cf/qwen/qwen1.5-1.8b-chat",
      "@cf/qwen/qwen1.5-7b-chat-awq",
      "@cf/qwen/qwen1.5-14b-chat-awq",
      "@cf/tinyllama/tinyllama-1.1b-chat-v1.0",
      "@cf/microsoft/phi-2",
      "@cf/thebloke/yarn-mistral-7b-64k-awq"
    ],
    class: AiTextGeneration,
    id: "c329a1f9-323d-4e91-b2aa-582dd4188d34"
  },
  translation: {
    models: ["@cf/meta/m2m100-1.2b"],
    class: AiTranslation,
    id: "f57d07cb-9087-487a-bbbf-bc3e17fecc4b"
  },
  summarization: {
    models: ["@cf/facebook/bart-large-cnn"],
    class: AiSummarization,
    id: "6f4e65d8-da0f-40d2-9aa4-db582a5a04fd"
  },
  "image-to-text": {
    models: ["@cf/unum/uform-gen2-qwen-500m"],
    class: AiImageToText,
    id: "882a91d1-c331-4eec-bdad-834c919942a8"
  }
};
var modelSettings = {
  // TGIs
  "@hf/thebloke/deepseek-coder-6.7b-instruct-awq": defaultTGI("deepseek", codeDefaultContext, ["<|EOT|>"]),
  "@hf/thebloke/deepseek-coder-6.7b-base-awq": defaultTGI("bare", codeDefaultContext),
  "@hf/thebloke/llamaguard-7b-awq": defaultTGI("inst", chatDefaultContext),
  "@hf/thebloke/openchat_3.5-awq": { ...defaultTGI("openchat", chatDefaultContext), experimental: true },
  "@hf/thebloke/openhermes-2.5-mistral-7b-awq": defaultTGI("chatml", chatDefaultContext, ["<|im_end|>"]),
  "@hf/thebloke/starling-lm-7b-alpha-awq": {
    ...defaultTGI("openchat", chatDefaultContext, ["<|end_of_turn|>"]),
    experimental: true
  },
  "@hf/thebloke/orca-2-13b-awq": { ...defaultTGI("chatml", chatDefaultContext), experimental: true },
  "@hf/thebloke/neural-chat-7b-v3-1-awq": defaultTGI("orca-hashes", chatDefaultContext),
  "@hf/thebloke/llama-2-13b-chat-awq": defaultTGI("llama2", chatDefaultContext),
  "@hf/thebloke/zephyr-7b-beta-awq": defaultTGI("zephyr", chatDefaultContext),
  "@hf/thebloke/mistral-7b-instruct-v0.1-awq": defaultTGI("mistral-instruct", chatDefaultContext),
  "@hf/thebloke/codellama-7b-instruct-awq": defaultTGI("llama2", codeDefaultContext),
  // vLLMs
  "@cf/thebloke/yarn-mistral-7b-64k-awq": { ...defaultvLLM, ...{ experimental: true } },
  "@cf/microsoft/phi-2": defaultvLLM,
  "@cf/defog/sqlcoder-7b-2": {
    ...defaultvLLM,
    ...{ preProcessingArgs: { promptTemplate: "sqlcoder", defaultContext: chatDefaultContext } }
  },
  "@cf/deepseek-ai/deepseek-math-7b-base": defaultvLLM,
  "@cf/deepseek-ai/deepseek-math-7b-instruct": defaultvLLM,
  "@cf/tiiuae/falcon-7b-instruct": {
    ...defaultvLLM,
    ...{ preProcessingArgs: { promptTemplate: "falcon", defaultContext: chatDefaultContext } }
  },
  "@cf/thebloke/discolm-german-7b-v1-awq": {
    ...defaultvLLM,
    ...{ preProcessingArgs: { promptTemplate: "chatml", defaultContext: chatDefaultContext } }
  },
  "@cf/qwen/qwen1.5-14b-chat-awq": {
    ...defaultvLLM,
    ...{ preProcessingArgs: { promptTemplate: "chatml", defaultContext: chatDefaultContext } }
  },
  "@cf/qwen/qwen1.5-0.5b-chat": {
    ...defaultvLLM,
    ...{ preProcessingArgs: { promptTemplate: "chatml", defaultContext: chatDefaultContext } }
  },
  "@cf/qwen/qwen1.5-1.8b-chat": {
    ...defaultvLLM,
    ...{ preProcessingArgs: { promptTemplate: "chatml", defaultContext: chatDefaultContext } }
  },
  "@cf/qwen/qwen1.5-7b-chat-awq": {
    ...defaultvLLM,
    ...{ preProcessingArgs: { promptTemplate: "chatml", defaultContext: chatDefaultContext } }
  },
  "@cf/tinyllama/tinyllama-1.1b-chat-v1.0": {
    ...defaultvLLM,
    ...{ preProcessingArgs: { promptTemplate: "tinyllama", defaultContext: chatDefaultContext } }
  },
  "@cf/openchat/openchat-3.5-0106": {
    ...defaultvLLM,
    ...{ preProcessingArgs: { promptTemplate: "openchat-alt", defaultContext: chatDefaultContext } }
  },
  // Others
  "@cf/unum/uform-gen2-qwen-500m": {
    postProcessingFunc: (response, inputs) => {
      return response.name.value[0].replace("<|im_end|>", "");
    }
  },
  "@cf/jpmorganchase/roberta-spam": {
    experimental: true
  },
  "@hf/sentence-transformers/all-minilm-l6-v2": {
    experimental: true
  },
  "@hf/baai/bge-base-en-v1.5": {
    postProcessingFunc: (r, inputs) => {
      return {
        shape: r.data.shape,
        data: r.data.value
      };
    }
  },
  "@cf/meta/llama-2-7b-chat-fp16": {
    inputsDefaultsStream: {
      max_tokens: 2500
    },
    inputsDefaults: {
      max_tokens: 256
    },
    preProcessingArgs: {
      promptTemplate: "llama2",
      defaultContext: chatDefaultContext
    }
  },
  "@cf/meta/llama-2-7b-chat-int8": {
    inputsDefaultsStream: {
      max_tokens: 1800
    },
    inputsDefaults: {
      max_tokens: 256
    },
    preProcessingArgs: {
      promptTemplate: "llama2",
      defaultContext: chatDefaultContext
    }
  },
  "@cf/openai/whisper": {
    postProcessingFunc: (response, inputs) => {
      if (response["word_count"]) {
        return {
          text: response["name"].value.join("").trim(),
          word_count: parseInt(response["word_count"].value),
          words: response["name"].value.map((w, i) => {
            return {
              word: w.trim(),
              start: response["timestamps"].value[0][i][0],
              end: response["timestamps"].value[0][i][1]
            };
          })
        };
      } else {
        return {
          text: response["name"].value.join("").trim()
        };
      }
    }
  },
  "@cf/mistral/mistral-7b-instruct-v0.1": {
    inputsDefaultsStream: {
      max_tokens: 1800
    },
    inputsDefaults: {
      max_tokens: 256
    },
    preProcessingArgs: {
      promptTemplate: "mistral-instruct",
      defaultContext: chatDefaultContext
    }
  }
};
var addModel = (task, model, settings) => {
  modelMappings[task].models.push(model);
  modelSettings[model] = settings;
};
var debugLog = (dd, what, args) => {
  if (dd) {
    console.log(`\x1B[1m${what}`);
    if (args[0] !== false) {
      if (typeof args == "object" || Array.isArray(args)) {
        const json = JSON.stringify(args);
        console.log(json.length > 512 ? `${json.substring(0, 512)}...` : json);
      } else {
        console.log(args);
      }
    }
  }
};
var parseInputs = (inputs) => {
  if (Array.isArray(inputs)) {
    return inputs.map((input) => input.toJSON());
  }
  if (inputs !== null && typeof inputs === "object") {
    return Object.keys(inputs).map((key) => {
      let tensor = inputs[key].toJSON();
      tensor.name = key;
      return tensor;
    });
  }
  throw new Error(`invalid inputs, must be Array<Tensor<any>> | TensorsObject`);
};
var tensorByName = (result) => {
  const outputByName = {};
  for (let i = 0, len = result.length; i < len; i++) {
    const tensor = Tensor.fromJSON(result[i]);
    const name = tensor.name || "output" + i;
    outputByName[name] = tensor;
  }
  return outputByName;
};
var getModelSettings = (model, key) => {
  const models = Object.keys(modelSettings);
  for (var m in models) {
    if (models[m] == model) {
      return key ? modelSettings[models[m]][key] : modelSettings[models[m]];
    }
  }
  return false;
};
var setModelSettings = (model, settings) => {
  modelSettings[model] = settings;
};
var EventSourceParserStream = class extends TransformStream {
  constructor() {
    let parser;
    super({
      start(controller) {
        parser = createParser((event) => {
          if (event.type === "event") {
            controller.enqueue(event);
          }
        });
      },
      transform(chunk) {
        parser.feed(chunk);
      }
    });
  }
};
var BOM = [239, 187, 191];
function hasBom(buffer) {
  return BOM.every((charCode, index) => buffer.charCodeAt(index) === charCode);
}
function createParser(onParse) {
  let isFirstChunk;
  let buffer;
  let startingPosition;
  let startingFieldLength;
  let eventId;
  let eventName;
  let data;
  reset();
  return { feed, reset };
  function reset() {
    isFirstChunk = true;
    buffer = "";
    startingPosition = 0;
    startingFieldLength = -1;
    eventId = void 0;
    eventName = void 0;
    data = "";
  }
  function feed(chunk) {
    buffer = buffer ? buffer + chunk : chunk;
    if (isFirstChunk && hasBom(buffer)) {
      buffer = buffer.slice(BOM.length);
    }
    isFirstChunk = false;
    const length = buffer.length;
    let position = 0;
    let discardTrailingNewline = false;
    while (position < length) {
      if (discardTrailingNewline) {
        if (buffer[position] === "\n") {
          ++position;
        }
        discardTrailingNewline = false;
      }
      let lineLength = -1;
      let fieldLength = startingFieldLength;
      let character;
      for (let index = startingPosition; lineLength < 0 && index < length; ++index) {
        character = buffer[index];
        if (character === ":" && fieldLength < 0) {
          fieldLength = index - position;
        } else if (character === "\r") {
          discardTrailingNewline = true;
          lineLength = index - position;
        } else if (character === "\n") {
          lineLength = index - position;
        }
      }
      if (lineLength < 0) {
        startingPosition = length - position;
        startingFieldLength = fieldLength;
        break;
      } else {
        startingPosition = 0;
        startingFieldLength = -1;
      }
      parseEventStreamLine(buffer, position, fieldLength, lineLength);
      position += lineLength + 1;
    }
    if (position === length) {
      buffer = "";
    } else if (position > 0) {
      buffer = buffer.slice(position);
    }
  }
  function parseEventStreamLine(lineBuffer, index, fieldLength, lineLength) {
    if (lineLength === 0) {
      if (data.length > 0) {
        onParse({
          type: "event",
          id: eventId,
          event: eventName || void 0,
          data: data.slice(0, -1)
          // remove trailing newline
        });
        data = "";
        eventId = void 0;
      }
      eventName = void 0;
      return;
    }
    const noValue = fieldLength < 0;
    const field = lineBuffer.slice(index, index + (noValue ? lineLength : fieldLength));
    let step = 0;
    if (noValue) {
      step = lineLength;
    } else if (lineBuffer[index + fieldLength + 1] === " ") {
      step = fieldLength + 2;
    } else {
      step = fieldLength + 1;
    }
    const position = index + step;
    const valueLength = lineLength - step;
    const value = lineBuffer.slice(position, position + valueLength).toString();
    if (field === "data") {
      data += value ? `${value}
` : "\n";
    } else if (field === "event") {
      eventName = value;
    } else if (field === "id" && !value.includes("\0")) {
      eventId = value;
    } else if (field === "retry") {
      const retry = parseInt(value, 10);
      if (!Number.isNaN(retry)) {
        onParse({ type: "reconnect-interval", value: retry });
      }
    }
  }
}
var ResultStream = class extends TransformStream {
  constructor() {
    super({
      transform(chunk, controller) {
        if (chunk.data === "[DONE]") {
          return;
        }
        try {
          const data = JSON.parse(chunk.data);
          controller.enqueue(data);
        } catch (err) {
          console.error(`failed to parse incoming data (${err.stack}): ${chunk.data}`);
          return;
        }
      }
    });
  }
};
var getEventStream = (body) => {
  const { readable, writable } = new TransformStream();
  const eventStream = (body ?? new ReadableStream()).pipeThrough(new TextDecoderStream()).pipeThrough(new EventSourceParserStream()).pipeThrough(new ResultStream());
  const reader = eventStream.getReader();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  const write = async (data) => {
    await writer.write(encoder.encode(data));
  };
  return {
    readable,
    reader,
    writer,
    write
  };
};
var readStream = (body, debug, ctx, tensorData, postProcessing) => {
  const { readable, reader, writer, write } = getEventStream(body);
  let len = 0;
  const waitUntil = ctx && ctx.waitUntil ? (f) => ctx.waitUntil(f()) : (f) => f();
  waitUntil(async () => {
    try {
      for (; ; ) {
        const { done, value } = await reader.read();
        if (done) {
          await write("data: [DONE]\n\n");
          break;
        }
        debugLog(debug, `stream response (len: ${len})`, value);
        if (tensorData) {
          const output = tensorByName(value.result);
          await write(
            `data: ${JSON.stringify(
              postProcessing ? postProcessing(output, (l) => {
                len += l;
                return len;
              }) : output
            )}

`
          );
        } else {
          await write(`data: ${JSON.stringify(value)}

`);
        }
      }
    } catch (e) {
      console.error(e.stack);
      await write(`$error: ${e.stack.toString()}

`);
    }
    await writer.close();
  });
  return readable;
};
var InferenceUpstreamError = class extends Error {
  httpCode;
  requestId;
  constructor(message, httpCode, requestId) {
    super(message);
    this.name = "InferenceUpstreamError";
    this.httpCode = httpCode;
    this.requestId = requestId;
  }
};
var InferenceSession = class {
  binding;
  model;
  options;
  lastRequestId;
  constructor(binding, model, options = {}) {
    this.binding = binding;
    this.model = model;
    this.options = options;
    this.lastRequestId = "";
  }
  async run(inputs, options) {
    const reqId = crypto.randomUUID();
    this.lastRequestId = reqId;
    const jsonInputs = parseInputs(inputs);
    const inferRequest = {
      input: jsonInputs,
      stream: false
    };
    if (options?.stream) {
      inferRequest.stream = options?.stream;
    }
    const body = JSON.stringify(inferRequest);
    const compressedReadableStream = new Response(body).body.pipeThrough(new CompressionStream("gzip"));
    const fetchOptions = {
      method: "POST",
      body: compressedReadableStream,
      headers: {
        ...this.options?.extraHeaders || {},
        "content-encoding": "gzip",
        "cf-ai-req-id": reqId,
        "cf-consn-sdk-version": "1.0.53",
        "cf-consn-model-id": `${this.options.prefix ? `${this.options.prefix}:` : ""}${this.model}`
      }
    };
    const res = this.options.apiEndpoint ? await fetch(this.options.apiEndpoint, fetchOptions) : await this.binding.fetch("http://workers-binding.ai/run", fetchOptions);
    if (!res.ok) {
      throw new InferenceUpstreamError(await res.text(), res.status, reqId);
    }
    if (!options?.stream) {
      const { result } = await res.json();
      return tensorByName(result);
    } else {
      return readStream(res.body, this.options.debug, this.options.ctx, true, options.postProcessing);
    }
  }
};
var Ai = class {
  binding;
  options;
  task;
  lastRequestId;
  constructor(binding, options = {}) {
    if (binding) {
      this.binding = binding;
      this.options = options;
      this.lastRequestId = "";
    } else {
      throw new Error("Ai binding is undefined. Please provide a valid binding.");
    }
  }
  addModel(task, model, settings) {
    addModel(task, model, settings);
  }
  overrideSettings(model, values) {
    let settings = getModelSettings(model);
    if (!settings)
      settings = {};
    settings = { ...settings, ...values };
    setModelSettings(model, settings);
  }
  async run(model, inputs) {
    const tasks = Object.keys(modelMappings);
    for (var t in tasks) {
      if (modelMappings[tasks[t]].models.indexOf(model) !== -1) {
        const settings = getModelSettings(model);
        const sessionOptions = this.options.sessionOptions || {};
        this.task = new modelMappings[tasks[t]].class(inputs, settings);
        debugLog(this.options.debug, "input", inputs);
        if (this.options.apiGateway) {
          const fetchOptions = {
            method: "POST",
            body: JSON.stringify(inputs),
            headers: {
              authorization: `Bearer ${this.options.apiToken}`,
              "content-type": "application/json"
            }
          };
          const res = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${this.options.apiAccount}/ai/run/${model}`,
            fetchOptions
          );
          if (!res.ok) {
            throw new Error(await res.text());
          }
          if (res.headers.get("content-type") == "application/json") {
            const { result } = await res.json();
            return result;
          } else if (res.headers.get("content-type") == "text/event-stream") {
            return readStream(res.body, this.options.debug, sessionOptions.ctx, false, false);
          } else {
            const blob = await res.blob();
            return blob;
          }
        } else {
          this.task.preProcessing();
          debugLog(this.options.debug, "pre-processed inputs", this.task.preProcessedInputs);
          this.task.tensors = this.task.generateTensors(this.task.preProcessedInputs);
          debugLog(this.options.debug, "input tensors", this.task.tensors);
          const session = new InferenceSession(this.binding, model, {
            ...{ debug: this.options.debug ? true : false },
            ...sessionOptions
          });
          if (inputs.stream) {
            debugLog(this.options.debug, "streaming", false);
            const response = await session.run(this.task.tensors, {
              stream: true,
              postProcessing: (r, inclen) => {
                return this.task.postProcessingStream(r, inclen);
              }
            });
            debugLog(this.options.debug, "cf-ai-req-id", session.lastRequestId);
            this.lastRequestId = session.lastRequestId;
            return response;
          } else {
            const response = await session.run(this.task.tensors);
            debugLog(this.options.debug, "response", response);
            this.task.postProcessing(response);
            debugLog(this.options.debug, "post-processed response", this.task.postProcessedOutputs);
            debugLog(this.options.debug, "cf-ai-req-id", session.lastRequestId);
            this.lastRequestId = session.lastRequestId;
            return this.task.postProcessedOutputs;
          }
        }
      }
    }
    throw new Error(`No such model ${model} or task`);
  }
};

// node_modules/hono/dist/utils/html.js
var HtmlEscapedCallbackPhase = {
  Stringify: 1,
  BeforeStream: 2,
  Stream: 3
};
var raw = (value, callbacks) => {
  const escapedString = new String(value);
  escapedString.isEscaped = true;
  escapedString.callbacks = callbacks;
  return escapedString;
};
var resolveCallback = async (str, phase, preserveCallbacks, context, buffer) => {
  const callbacks = str.callbacks;
  if (!callbacks?.length) {
    return Promise.resolve(str);
  }
  if (buffer) {
    buffer[0] += str;
  } else {
    buffer = [str];
  }
  const resStr = Promise.all(callbacks.map((c) => c({ phase, buffer, context }))).then(
    (res) => Promise.all(
      res.filter(Boolean).map((str2) => resolveCallback(str2, phase, false, context, buffer))
    ).then(() => buffer[0])
  );
  if (preserveCallbacks) {
    return raw(await resStr, callbacks);
  } else {
    return resStr;
  }
};

// node_modules/hono/dist/context.js
var __accessCheck = (obj, member, msg) => {
  if (!member.has(obj))
    throw TypeError("Cannot " + msg);
};
var __privateGet = (obj, member, getter) => {
  __accessCheck(obj, member, "read from private field");
  return getter ? getter.call(obj) : member.get(obj);
};
var __privateAdd = (obj, member, value) => {
  if (member.has(obj))
    throw TypeError("Cannot add the same private member more than once");
  member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
};
var __privateSet = (obj, member, value, setter) => {
  __accessCheck(obj, member, "write to private field");
  setter ? setter.call(obj, value) : member.set(obj, value);
  return value;
};
var TEXT_PLAIN = "text/plain; charset=UTF-8";
var setHeaders = (headers, map = {}) => {
  Object.entries(map).forEach(([key, value]) => headers.set(key, value));
  return headers;
};
var _status;
var _executionCtx;
var _headers;
var _preparedHeaders;
var _res;
var _isFresh;
var Context = class {
  constructor(req, options) {
    this.env = {};
    this._var = {};
    this.finalized = false;
    this.error = void 0;
    __privateAdd(this, _status, 200);
    __privateAdd(this, _executionCtx, void 0);
    __privateAdd(this, _headers, void 0);
    __privateAdd(this, _preparedHeaders, void 0);
    __privateAdd(this, _res, void 0);
    __privateAdd(this, _isFresh, true);
    this.layout = void 0;
    this.renderer = (content) => this.html(content);
    this.notFoundHandler = () => new Response();
    this.render = (...args) => this.renderer(...args);
    this.setLayout = (layout) => this.layout = layout;
    this.getLayout = () => this.layout;
    this.setRenderer = (renderer) => {
      this.renderer = renderer;
    };
    this.header = (name, value, options2) => {
      if (value === void 0) {
        if (__privateGet(this, _headers)) {
          __privateGet(this, _headers).delete(name);
        } else if (__privateGet(this, _preparedHeaders)) {
          delete __privateGet(this, _preparedHeaders)[name.toLocaleLowerCase()];
        }
        if (this.finalized) {
          this.res.headers.delete(name);
        }
        return;
      }
      if (options2?.append) {
        if (!__privateGet(this, _headers)) {
          __privateSet(this, _isFresh, false);
          __privateSet(this, _headers, new Headers(__privateGet(this, _preparedHeaders)));
          __privateSet(this, _preparedHeaders, {});
        }
        __privateGet(this, _headers).append(name, value);
      } else {
        if (__privateGet(this, _headers)) {
          __privateGet(this, _headers).set(name, value);
        } else {
          __privateGet(this, _preparedHeaders) ?? __privateSet(this, _preparedHeaders, {});
          __privateGet(this, _preparedHeaders)[name.toLowerCase()] = value;
        }
      }
      if (this.finalized) {
        if (options2?.append) {
          this.res.headers.append(name, value);
        } else {
          this.res.headers.set(name, value);
        }
      }
    };
    this.status = (status) => {
      __privateSet(this, _isFresh, false);
      __privateSet(this, _status, status);
    };
    this.set = (key, value) => {
      this._var ?? (this._var = {});
      this._var[key] = value;
    };
    this.get = (key) => {
      return this._var ? this._var[key] : void 0;
    };
    this.newResponse = (data, arg, headers) => {
      if (__privateGet(this, _isFresh) && !headers && !arg && __privateGet(this, _status) === 200) {
        return new Response(data, {
          headers: __privateGet(this, _preparedHeaders)
        });
      }
      if (arg && typeof arg !== "number") {
        const headers2 = setHeaders(new Headers(arg.headers), __privateGet(this, _preparedHeaders));
        return new Response(data, {
          headers: headers2,
          status: arg.status
        });
      }
      const status = typeof arg === "number" ? arg : __privateGet(this, _status);
      __privateGet(this, _preparedHeaders) ?? __privateSet(this, _preparedHeaders, {});
      __privateGet(this, _headers) ?? __privateSet(this, _headers, new Headers());
      setHeaders(__privateGet(this, _headers), __privateGet(this, _preparedHeaders));
      if (__privateGet(this, _res)) {
        __privateGet(this, _res).headers.forEach((v, k) => {
          __privateGet(this, _headers)?.set(k, v);
        });
        setHeaders(__privateGet(this, _headers), __privateGet(this, _preparedHeaders));
      }
      headers ?? (headers = {});
      for (const [k, v] of Object.entries(headers)) {
        if (typeof v === "string") {
          __privateGet(this, _headers).set(k, v);
        } else {
          __privateGet(this, _headers).delete(k);
          for (const v2 of v) {
            __privateGet(this, _headers).append(k, v2);
          }
        }
      }
      return new Response(data, {
        status,
        headers: __privateGet(this, _headers)
      });
    };
    this.body = (data, arg, headers) => {
      return typeof arg === "number" ? this.newResponse(data, arg, headers) : this.newResponse(data, arg);
    };
    this.text = (text, arg, headers) => {
      if (!__privateGet(this, _preparedHeaders)) {
        if (__privateGet(this, _isFresh) && !headers && !arg) {
          return new Response(text);
        }
        __privateSet(this, _preparedHeaders, {});
      }
      __privateGet(this, _preparedHeaders)["content-type"] = TEXT_PLAIN;
      return typeof arg === "number" ? this.newResponse(text, arg, headers) : this.newResponse(text, arg);
    };
    this.json = (object, arg, headers) => {
      const body = JSON.stringify(object);
      __privateGet(this, _preparedHeaders) ?? __privateSet(this, _preparedHeaders, {});
      __privateGet(this, _preparedHeaders)["content-type"] = "application/json; charset=UTF-8";
      return typeof arg === "number" ? this.newResponse(body, arg, headers) : this.newResponse(body, arg);
    };
    this.html = (html, arg, headers) => {
      __privateGet(this, _preparedHeaders) ?? __privateSet(this, _preparedHeaders, {});
      __privateGet(this, _preparedHeaders)["content-type"] = "text/html; charset=UTF-8";
      if (typeof html === "object") {
        if (!(html instanceof Promise)) {
          html = html.toString();
        }
        if (html instanceof Promise) {
          return html.then((html2) => resolveCallback(html2, HtmlEscapedCallbackPhase.Stringify, false, {})).then((html2) => {
            return typeof arg === "number" ? this.newResponse(html2, arg, headers) : this.newResponse(html2, arg);
          });
        }
      }
      return typeof arg === "number" ? this.newResponse(html, arg, headers) : this.newResponse(html, arg);
    };
    this.redirect = (location, status = 302) => {
      __privateGet(this, _headers) ?? __privateSet(this, _headers, new Headers());
      __privateGet(this, _headers).set("Location", location);
      return this.newResponse(null, status);
    };
    this.notFound = () => {
      return this.notFoundHandler(this);
    };
    this.req = req;
    if (options) {
      __privateSet(this, _executionCtx, options.executionCtx);
      this.env = options.env;
      if (options.notFoundHandler) {
        this.notFoundHandler = options.notFoundHandler;
      }
    }
  }
  get event() {
    if (__privateGet(this, _executionCtx) && "respondWith" in __privateGet(this, _executionCtx)) {
      return __privateGet(this, _executionCtx);
    } else {
      throw Error("This context has no FetchEvent");
    }
  }
  get executionCtx() {
    if (__privateGet(this, _executionCtx)) {
      return __privateGet(this, _executionCtx);
    } else {
      throw Error("This context has no ExecutionContext");
    }
  }
  get res() {
    __privateSet(this, _isFresh, false);
    return __privateGet(this, _res) || __privateSet(this, _res, new Response("404 Not Found", { status: 404 }));
  }
  set res(_res2) {
    __privateSet(this, _isFresh, false);
    if (__privateGet(this, _res) && _res2) {
      __privateGet(this, _res).headers.delete("content-type");
      for (const [k, v] of __privateGet(this, _res).headers.entries()) {
        if (k === "set-cookie") {
          const cookies = __privateGet(this, _res).headers.getSetCookie();
          _res2.headers.delete("set-cookie");
          for (const cookie of cookies) {
            _res2.headers.append("set-cookie", cookie);
          }
        } else {
          _res2.headers.set(k, v);
        }
      }
    }
    __privateSet(this, _res, _res2);
    this.finalized = true;
  }
  get var() {
    return { ...this._var };
  }
};
_status = /* @__PURE__ */ new WeakMap();
_executionCtx = /* @__PURE__ */ new WeakMap();
_headers = /* @__PURE__ */ new WeakMap();
_preparedHeaders = /* @__PURE__ */ new WeakMap();
_res = /* @__PURE__ */ new WeakMap();
_isFresh = /* @__PURE__ */ new WeakMap();

// node_modules/hono/dist/compose.js
var compose = (middleware, onError, onNotFound) => {
  return (context, next) => {
    let index = -1;
    return dispatch(0);
    async function dispatch(i) {
      if (i <= index) {
        throw new Error("next() called multiple times");
      }
      index = i;
      let res;
      let isError = false;
      let handler;
      if (middleware[i]) {
        handler = middleware[i][0][0];
        if (context instanceof Context) {
          context.req.routeIndex = i;
        }
      } else {
        handler = i === middleware.length && next || void 0;
      }
      if (!handler) {
        if (context instanceof Context && context.finalized === false && onNotFound) {
          res = await onNotFound(context);
        }
      } else {
        try {
          res = await handler(context, () => {
            return dispatch(i + 1);
          });
        } catch (err) {
          if (err instanceof Error && context instanceof Context && onError) {
            context.error = err;
            res = await onError(err, context);
            isError = true;
          } else {
            throw err;
          }
        }
      }
      if (res && (context.finalized === false || isError)) {
        context.res = res;
      }
      return context;
    }
  };
};

// node_modules/hono/dist/http-exception.js
var HTTPException = class extends Error {
  constructor(status = 500, options) {
    super(options?.message);
    this.res = options?.res;
    this.status = status;
  }
  getResponse() {
    if (this.res) {
      return this.res;
    }
    return new Response(this.message, {
      status: this.status
    });
  }
};

// node_modules/hono/dist/utils/body.js
var parseBody = async (request, options = { all: false }) => {
  const headers = request instanceof HonoRequest ? request.raw.headers : request.headers;
  const contentType = headers.get("Content-Type");
  if (isFormDataContent(contentType)) {
    return parseFormData(request, options);
  }
  return {};
};
function isFormDataContent(contentType) {
  if (contentType === null) {
    return false;
  }
  return contentType.startsWith("multipart/form-data") || contentType.startsWith("application/x-www-form-urlencoded");
}
async function parseFormData(request, options) {
  const formData = await request.formData();
  if (formData) {
    return convertFormDataToBodyData(formData, options);
  }
  return {};
}
function convertFormDataToBodyData(formData, options) {
  const form = {};
  formData.forEach((value, key) => {
    const shouldParseAllValues = options.all || key.endsWith("[]");
    if (!shouldParseAllValues) {
      form[key] = value;
    } else {
      handleParsingAllValues(form, key, value);
    }
  });
  return form;
}
var handleParsingAllValues = (form, key, value) => {
  if (form[key] && isArrayField(form[key])) {
    appendToExistingArray(form[key], value);
  } else if (form[key]) {
    convertToNewArray(form, key, value);
  } else {
    form[key] = value;
  }
};
function isArrayField(field) {
  return Array.isArray(field);
}
var appendToExistingArray = (arr, value) => {
  arr.push(value);
};
var convertToNewArray = (form, key, value) => {
  form[key] = [form[key], value];
};

// node_modules/hono/dist/utils/url.js
var splitPath = (path) => {
  const paths = path.split("/");
  if (paths[0] === "") {
    paths.shift();
  }
  return paths;
};
var splitRoutingPath = (routePath) => {
  const { groups, path } = extractGroupsFromPath(routePath);
  const paths = splitPath(path);
  return replaceGroupMarks(paths, groups);
};
var extractGroupsFromPath = (path) => {
  const groups = [];
  path = path.replace(/\{[^}]+\}/g, (match, index) => {
    const mark = `@${index}`;
    groups.push([mark, match]);
    return mark;
  });
  return { groups, path };
};
var replaceGroupMarks = (paths, groups) => {
  for (let i = groups.length - 1; i >= 0; i--) {
    const [mark] = groups[i];
    for (let j = paths.length - 1; j >= 0; j--) {
      if (paths[j].includes(mark)) {
        paths[j] = paths[j].replace(mark, groups[i][1]);
        break;
      }
    }
  }
  return paths;
};
var patternCache = {};
var getPattern = (label) => {
  if (label === "*") {
    return "*";
  }
  const match = label.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
  if (match) {
    if (!patternCache[label]) {
      if (match[2]) {
        patternCache[label] = [label, match[1], new RegExp("^" + match[2] + "$")];
      } else {
        patternCache[label] = [label, match[1], true];
      }
    }
    return patternCache[label];
  }
  return null;
};
var getPath = (request) => {
  const match = request.url.match(/^https?:\/\/[^/]+(\/[^?]*)/);
  return match ? match[1] : "";
};
var getQueryStrings = (url) => {
  const queryIndex = url.indexOf("?", 8);
  return queryIndex === -1 ? "" : "?" + url.slice(queryIndex + 1);
};
var getPathNoStrict = (request) => {
  const result = getPath(request);
  return result.length > 1 && result[result.length - 1] === "/" ? result.slice(0, -1) : result;
};
var mergePath = (...paths) => {
  let p = "";
  let endsWithSlash = false;
  for (let path of paths) {
    if (p[p.length - 1] === "/") {
      p = p.slice(0, -1);
      endsWithSlash = true;
    }
    if (path[0] !== "/") {
      path = `/${path}`;
    }
    if (path === "/" && endsWithSlash) {
      p = `${p}/`;
    } else if (path !== "/") {
      p = `${p}${path}`;
    }
    if (path === "/" && p === "") {
      p = "/";
    }
  }
  return p;
};
var checkOptionalParameter = (path) => {
  if (!path.match(/\:.+\?$/)) {
    return null;
  }
  const segments = path.split("/");
  const results = [];
  let basePath = "";
  segments.forEach((segment) => {
    if (segment !== "" && !/\:/.test(segment)) {
      basePath += "/" + segment;
    } else if (/\:/.test(segment)) {
      if (/\?/.test(segment)) {
        if (results.length === 0 && basePath === "") {
          results.push("/");
        } else {
          results.push(basePath);
        }
        const optionalSegment = segment.replace("?", "");
        basePath += "/" + optionalSegment;
        results.push(basePath);
      } else {
        basePath += "/" + segment;
      }
    }
  });
  return results.filter((v, i, a) => a.indexOf(v) === i);
};
var _decodeURI = (value) => {
  if (!/[%+]/.test(value)) {
    return value;
  }
  if (value.indexOf("+") !== -1) {
    value = value.replace(/\+/g, " ");
  }
  return /%/.test(value) ? decodeURIComponent_(value) : value;
};
var _getQueryParam = (url, key, multiple) => {
  let encoded;
  if (!multiple && key && !/[%+]/.test(key)) {
    let keyIndex2 = url.indexOf(`?${key}`, 8);
    if (keyIndex2 === -1) {
      keyIndex2 = url.indexOf(`&${key}`, 8);
    }
    while (keyIndex2 !== -1) {
      const trailingKeyCode = url.charCodeAt(keyIndex2 + key.length + 1);
      if (trailingKeyCode === 61) {
        const valueIndex = keyIndex2 + key.length + 2;
        const endIndex = url.indexOf("&", valueIndex);
        return _decodeURI(url.slice(valueIndex, endIndex === -1 ? void 0 : endIndex));
      } else if (trailingKeyCode == 38 || isNaN(trailingKeyCode)) {
        return "";
      }
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    encoded = /[%+]/.test(url);
    if (!encoded) {
      return void 0;
    }
  }
  const results = {};
  encoded ?? (encoded = /[%+]/.test(url));
  let keyIndex = url.indexOf("?", 8);
  while (keyIndex !== -1) {
    const nextKeyIndex = url.indexOf("&", keyIndex + 1);
    let valueIndex = url.indexOf("=", keyIndex);
    if (valueIndex > nextKeyIndex && nextKeyIndex !== -1) {
      valueIndex = -1;
    }
    let name = url.slice(
      keyIndex + 1,
      valueIndex === -1 ? nextKeyIndex === -1 ? void 0 : nextKeyIndex : valueIndex
    );
    if (encoded) {
      name = _decodeURI(name);
    }
    keyIndex = nextKeyIndex;
    if (name === "") {
      continue;
    }
    let value;
    if (valueIndex === -1) {
      value = "";
    } else {
      value = url.slice(valueIndex + 1, nextKeyIndex === -1 ? void 0 : nextKeyIndex);
      if (encoded) {
        value = _decodeURI(value);
      }
    }
    if (multiple) {
      if (!(results[name] && Array.isArray(results[name]))) {
        results[name] = [];
      }
      ;
      results[name].push(value);
    } else {
      results[name] ?? (results[name] = value);
    }
  }
  return key ? results[key] : results;
};
var getQueryParam = _getQueryParam;
var getQueryParams = (url, key) => {
  return _getQueryParam(url, key, true);
};
var decodeURIComponent_ = decodeURIComponent;

// node_modules/hono/dist/request.js
var __accessCheck2 = (obj, member, msg) => {
  if (!member.has(obj))
    throw TypeError("Cannot " + msg);
};
var __privateGet2 = (obj, member, getter) => {
  __accessCheck2(obj, member, "read from private field");
  return getter ? getter.call(obj) : member.get(obj);
};
var __privateAdd2 = (obj, member, value) => {
  if (member.has(obj))
    throw TypeError("Cannot add the same private member more than once");
  member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
};
var __privateSet2 = (obj, member, value, setter) => {
  __accessCheck2(obj, member, "write to private field");
  setter ? setter.call(obj, value) : member.set(obj, value);
  return value;
};
var _validatedData;
var _matchResult;
var HonoRequest = class {
  constructor(request, path = "/", matchResult = [[]]) {
    __privateAdd2(this, _validatedData, void 0);
    __privateAdd2(this, _matchResult, void 0);
    this.routeIndex = 0;
    this.bodyCache = {};
    this.cachedBody = (key) => {
      const { bodyCache, raw: raw2 } = this;
      const cachedBody = bodyCache[key];
      if (cachedBody) {
        return cachedBody;
      }
      if (bodyCache.arrayBuffer) {
        return (async () => {
          return await new Response(bodyCache.arrayBuffer)[key]();
        })();
      }
      return bodyCache[key] = raw2[key]();
    };
    this.raw = request;
    this.path = path;
    __privateSet2(this, _matchResult, matchResult);
    __privateSet2(this, _validatedData, {});
  }
  param(key) {
    return key ? this.getDecodedParam(key) : this.getAllDecodedParams();
  }
  getDecodedParam(key) {
    const paramKey = __privateGet2(this, _matchResult)[0][this.routeIndex][1][key];
    const param = this.getParamValue(paramKey);
    return param ? /\%/.test(param) ? decodeURIComponent_(param) : param : void 0;
  }
  getAllDecodedParams() {
    const decoded = {};
    const keys = Object.keys(__privateGet2(this, _matchResult)[0][this.routeIndex][1]);
    for (const key of keys) {
      const value = this.getParamValue(__privateGet2(this, _matchResult)[0][this.routeIndex][1][key]);
      if (value && typeof value === "string") {
        decoded[key] = /\%/.test(value) ? decodeURIComponent_(value) : value;
      }
    }
    return decoded;
  }
  getParamValue(paramKey) {
    return __privateGet2(this, _matchResult)[1] ? __privateGet2(this, _matchResult)[1][paramKey] : paramKey;
  }
  query(key) {
    return getQueryParam(this.url, key);
  }
  queries(key) {
    return getQueryParams(this.url, key);
  }
  header(name) {
    if (name) {
      return this.raw.headers.get(name.toLowerCase()) ?? void 0;
    }
    const headerData = {};
    this.raw.headers.forEach((value, key) => {
      headerData[key] = value;
    });
    return headerData;
  }
  async parseBody(options) {
    if (this.bodyCache.parsedBody) {
      return this.bodyCache.parsedBody;
    }
    const parsedBody = await parseBody(this, options);
    this.bodyCache.parsedBody = parsedBody;
    return parsedBody;
  }
  json() {
    return this.cachedBody("json");
  }
  text() {
    return this.cachedBody("text");
  }
  arrayBuffer() {
    return this.cachedBody("arrayBuffer");
  }
  blob() {
    return this.cachedBody("blob");
  }
  formData() {
    return this.cachedBody("formData");
  }
  addValidatedData(target, data) {
    __privateGet2(this, _validatedData)[target] = data;
  }
  valid(target) {
    return __privateGet2(this, _validatedData)[target];
  }
  get url() {
    return this.raw.url;
  }
  get method() {
    return this.raw.method;
  }
  get matchedRoutes() {
    return __privateGet2(this, _matchResult)[0].map(([[, route]]) => route);
  }
  get routePath() {
    return __privateGet2(this, _matchResult)[0].map(([[, route]]) => route)[this.routeIndex].path;
  }
};
_validatedData = /* @__PURE__ */ new WeakMap();
_matchResult = /* @__PURE__ */ new WeakMap();

// node_modules/hono/dist/router.js
var METHOD_NAME_ALL = "ALL";
var METHOD_NAME_ALL_LOWERCASE = "all";
var METHODS = ["get", "post", "put", "delete", "options", "patch"];
var MESSAGE_MATCHER_IS_ALREADY_BUILT = "Can not add a route since the matcher is already built.";
var UnsupportedPathError = class extends Error {
};

// node_modules/hono/dist/hono-base.js
var __accessCheck3 = (obj, member, msg) => {
  if (!member.has(obj))
    throw TypeError("Cannot " + msg);
};
var __privateGet3 = (obj, member, getter) => {
  __accessCheck3(obj, member, "read from private field");
  return getter ? getter.call(obj) : member.get(obj);
};
var __privateAdd3 = (obj, member, value) => {
  if (member.has(obj))
    throw TypeError("Cannot add the same private member more than once");
  member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
};
var __privateSet3 = (obj, member, value, setter) => {
  __accessCheck3(obj, member, "write to private field");
  setter ? setter.call(obj, value) : member.set(obj, value);
  return value;
};
var COMPOSED_HANDLER = Symbol("composedHandler");
function defineDynamicClass() {
  return class {
  };
}
var notFoundHandler = (c) => {
  return c.text("404 Not Found", 404);
};
var errorHandler = (err, c) => {
  if (err instanceof HTTPException) {
    return err.getResponse();
  }
  console.error(err);
  return c.text("Internal Server Error", 500);
};
var _path;
var _Hono = class extends defineDynamicClass() {
  constructor(options = {}) {
    super();
    this._basePath = "/";
    __privateAdd3(this, _path, "/");
    this.routes = [];
    this.notFoundHandler = notFoundHandler;
    this.errorHandler = errorHandler;
    this.onError = (handler) => {
      this.errorHandler = handler;
      return this;
    };
    this.notFound = (handler) => {
      this.notFoundHandler = handler;
      return this;
    };
    this.fetch = (request, Env, executionCtx) => {
      return this.dispatch(request, executionCtx, Env, request.method);
    };
    this.request = (input, requestInit, Env, executionCtx) => {
      if (input instanceof Request) {
        if (requestInit !== void 0) {
          input = new Request(input, requestInit);
        }
        return this.fetch(input, Env, executionCtx);
      }
      input = input.toString();
      const path = /^https?:\/\//.test(input) ? input : `http://localhost${mergePath("/", input)}`;
      const req = new Request(path, requestInit);
      return this.fetch(req, Env, executionCtx);
    };
    this.fire = () => {
      addEventListener("fetch", (event) => {
        event.respondWith(this.dispatch(event.request, event, void 0, event.request.method));
      });
    };
    const allMethods = [...METHODS, METHOD_NAME_ALL_LOWERCASE];
    allMethods.map((method) => {
      this[method] = (args1, ...args) => {
        if (typeof args1 === "string") {
          __privateSet3(this, _path, args1);
        } else {
          this.addRoute(method, __privateGet3(this, _path), args1);
        }
        args.map((handler) => {
          if (typeof handler !== "string") {
            this.addRoute(method, __privateGet3(this, _path), handler);
          }
        });
        return this;
      };
    });
    this.on = (method, path, ...handlers) => {
      if (!method) {
        return this;
      }
      for (const p of [path].flat()) {
        __privateSet3(this, _path, p);
        for (const m of [method].flat()) {
          handlers.map((handler) => {
            this.addRoute(m.toUpperCase(), __privateGet3(this, _path), handler);
          });
        }
      }
      return this;
    };
    this.use = (arg1, ...handlers) => {
      if (typeof arg1 === "string") {
        __privateSet3(this, _path, arg1);
      } else {
        __privateSet3(this, _path, "*");
        handlers.unshift(arg1);
      }
      handlers.map((handler) => {
        this.addRoute(METHOD_NAME_ALL, __privateGet3(this, _path), handler);
      });
      return this;
    };
    const strict = options.strict ?? true;
    delete options.strict;
    Object.assign(this, options);
    this.getPath = strict ? options.getPath ?? getPath : getPathNoStrict;
  }
  clone() {
    const clone = new _Hono({
      router: this.router,
      getPath: this.getPath
    });
    clone.routes = this.routes;
    return clone;
  }
  route(path, app2) {
    const subApp = this.basePath(path);
    if (!app2) {
      return subApp;
    }
    app2.routes.map((r) => {
      let handler;
      if (app2.errorHandler === errorHandler) {
        handler = r.handler;
      } else {
        handler = async (c, next) => (await compose([], app2.errorHandler)(c, () => r.handler(c, next))).res;
        handler[COMPOSED_HANDLER] = r.handler;
      }
      subApp.addRoute(r.method, r.path, handler);
    });
    return this;
  }
  basePath(path) {
    const subApp = this.clone();
    subApp._basePath = mergePath(this._basePath, path);
    return subApp;
  }
  mount(path, applicationHandler, optionHandler) {
    const mergedPath = mergePath(this._basePath, path);
    const pathPrefixLength = mergedPath === "/" ? 0 : mergedPath.length;
    const handler = async (c, next) => {
      let executionContext = void 0;
      try {
        executionContext = c.executionCtx;
      } catch {
      }
      const options = optionHandler ? optionHandler(c) : [c.env, executionContext];
      const optionsArray = Array.isArray(options) ? options : [options];
      const queryStrings = getQueryStrings(c.req.url);
      const res = await applicationHandler(
        new Request(
          new URL((c.req.path.slice(pathPrefixLength) || "/") + queryStrings, c.req.url),
          c.req.raw
        ),
        ...optionsArray
      );
      if (res) {
        return res;
      }
      await next();
    };
    this.addRoute(METHOD_NAME_ALL, mergePath(path, "*"), handler);
    return this;
  }
  addRoute(method, path, handler) {
    method = method.toUpperCase();
    path = mergePath(this._basePath, path);
    const r = { path, method, handler };
    this.router.add(method, path, [handler, r]);
    this.routes.push(r);
  }
  matchRoute(method, path) {
    return this.router.match(method, path);
  }
  handleError(err, c) {
    if (err instanceof Error) {
      return this.errorHandler(err, c);
    }
    throw err;
  }
  dispatch(request, executionCtx, env, method) {
    if (method === "HEAD") {
      return (async () => new Response(null, await this.dispatch(request, executionCtx, env, "GET")))();
    }
    const path = this.getPath(request, { env });
    const matchResult = this.matchRoute(method, path);
    const c = new Context(new HonoRequest(request, path, matchResult), {
      env,
      executionCtx,
      notFoundHandler: this.notFoundHandler
    });
    if (matchResult[0].length === 1) {
      let res;
      try {
        res = matchResult[0][0][0][0](c, async () => {
        });
        if (!res) {
          return this.notFoundHandler(c);
        }
      } catch (err) {
        return this.handleError(err, c);
      }
      return res instanceof Promise ? res.then(
        (resolved) => resolved || (c.finalized ? c.res : this.notFoundHandler(c))
      ).catch((err) => this.handleError(err, c)) : res;
    }
    const composed = compose(matchResult[0], this.errorHandler, this.notFoundHandler);
    return (async () => {
      try {
        const context = await composed(c);
        if (!context.finalized) {
          throw new Error(
            "Context is not finalized. You may forget returning Response object or `await next()`"
          );
        }
        return context.res;
      } catch (err) {
        return this.handleError(err, c);
      }
    })();
  }
};
var Hono = _Hono;
_path = /* @__PURE__ */ new WeakMap();

// node_modules/hono/dist/router/reg-exp-router/node.js
var LABEL_REG_EXP_STR = "[^/]+";
var ONLY_WILDCARD_REG_EXP_STR = ".*";
var TAIL_WILDCARD_REG_EXP_STR = "(?:|/.*)";
var PATH_ERROR = Symbol();
function compareKey(a, b) {
  if (a.length === 1) {
    return b.length === 1 ? a < b ? -1 : 1 : -1;
  }
  if (b.length === 1) {
    return 1;
  }
  if (a === ONLY_WILDCARD_REG_EXP_STR || a === TAIL_WILDCARD_REG_EXP_STR) {
    return 1;
  } else if (b === ONLY_WILDCARD_REG_EXP_STR || b === TAIL_WILDCARD_REG_EXP_STR) {
    return -1;
  }
  if (a === LABEL_REG_EXP_STR) {
    return 1;
  } else if (b === LABEL_REG_EXP_STR) {
    return -1;
  }
  return a.length === b.length ? a < b ? -1 : 1 : b.length - a.length;
}
var Node = class {
  constructor() {
    this.children = {};
  }
  insert(tokens, index, paramMap, context, pathErrorCheckOnly) {
    if (tokens.length === 0) {
      if (this.index !== void 0) {
        throw PATH_ERROR;
      }
      if (pathErrorCheckOnly) {
        return;
      }
      this.index = index;
      return;
    }
    const [token, ...restTokens] = tokens;
    const pattern = token === "*" ? restTokens.length === 0 ? ["", "", ONLY_WILDCARD_REG_EXP_STR] : ["", "", LABEL_REG_EXP_STR] : token === "/*" ? ["", "", TAIL_WILDCARD_REG_EXP_STR] : token.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
    let node;
    if (pattern) {
      const name = pattern[1];
      let regexpStr = pattern[2] || LABEL_REG_EXP_STR;
      if (name && pattern[2]) {
        regexpStr = regexpStr.replace(/^\((?!\?:)(?=[^)]+\)$)/, "(?:");
        if (/\((?!\?:)/.test(regexpStr)) {
          throw PATH_ERROR;
        }
      }
      node = this.children[regexpStr];
      if (!node) {
        if (Object.keys(this.children).some(
          (k) => k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
        )) {
          throw PATH_ERROR;
        }
        if (pathErrorCheckOnly) {
          return;
        }
        node = this.children[regexpStr] = new Node();
        if (name !== "") {
          node.varIndex = context.varIndex++;
        }
      }
      if (!pathErrorCheckOnly && name !== "") {
        paramMap.push([name, node.varIndex]);
      }
    } else {
      node = this.children[token];
      if (!node) {
        if (Object.keys(this.children).some(
          (k) => k.length > 1 && k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
        )) {
          throw PATH_ERROR;
        }
        if (pathErrorCheckOnly) {
          return;
        }
        node = this.children[token] = new Node();
      }
    }
    node.insert(restTokens, index, paramMap, context, pathErrorCheckOnly);
  }
  buildRegExpStr() {
    const childKeys = Object.keys(this.children).sort(compareKey);
    const strList = childKeys.map((k) => {
      const c = this.children[k];
      return (typeof c.varIndex === "number" ? `(${k})@${c.varIndex}` : k) + c.buildRegExpStr();
    });
    if (typeof this.index === "number") {
      strList.unshift(`#${this.index}`);
    }
    if (strList.length === 0) {
      return "";
    }
    if (strList.length === 1) {
      return strList[0];
    }
    return "(?:" + strList.join("|") + ")";
  }
};

// node_modules/hono/dist/router/reg-exp-router/trie.js
var Trie = class {
  constructor() {
    this.context = { varIndex: 0 };
    this.root = new Node();
  }
  insert(path, index, pathErrorCheckOnly) {
    const paramAssoc = [];
    const groups = [];
    for (let i = 0; ; ) {
      let replaced = false;
      path = path.replace(/\{[^}]+\}/g, (m) => {
        const mark = `@\\${i}`;
        groups[i] = [mark, m];
        i++;
        replaced = true;
        return mark;
      });
      if (!replaced) {
        break;
      }
    }
    const tokens = path.match(/(?::[^\/]+)|(?:\/\*$)|./g) || [];
    for (let i = groups.length - 1; i >= 0; i--) {
      const [mark] = groups[i];
      for (let j = tokens.length - 1; j >= 0; j--) {
        if (tokens[j].indexOf(mark) !== -1) {
          tokens[j] = tokens[j].replace(mark, groups[i][1]);
          break;
        }
      }
    }
    this.root.insert(tokens, index, paramAssoc, this.context, pathErrorCheckOnly);
    return paramAssoc;
  }
  buildRegExp() {
    let regexp = this.root.buildRegExpStr();
    if (regexp === "") {
      return [/^$/, [], []];
    }
    let captureIndex = 0;
    const indexReplacementMap = [];
    const paramReplacementMap = [];
    regexp = regexp.replace(/#(\d+)|@(\d+)|\.\*\$/g, (_, handlerIndex, paramIndex) => {
      if (typeof handlerIndex !== "undefined") {
        indexReplacementMap[++captureIndex] = Number(handlerIndex);
        return "$()";
      }
      if (typeof paramIndex !== "undefined") {
        paramReplacementMap[Number(paramIndex)] = ++captureIndex;
        return "";
      }
      return "";
    });
    return [new RegExp(`^${regexp}`), indexReplacementMap, paramReplacementMap];
  }
};

// node_modules/hono/dist/router/reg-exp-router/router.js
var methodNames = [METHOD_NAME_ALL, ...METHODS].map((method) => method.toUpperCase());
var emptyParam = [];
var nullMatcher = [/^$/, [], {}];
var wildcardRegExpCache = {};
function buildWildcardRegExp(path) {
  return wildcardRegExpCache[path] ?? (wildcardRegExpCache[path] = new RegExp(
    path === "*" ? "" : `^${path.replace(/\/\*/, "(?:|/.*)")}$`
  ));
}
function clearWildcardRegExpCache() {
  wildcardRegExpCache = {};
}
function buildMatcherFromPreprocessedRoutes(routes) {
  const trie = new Trie();
  const handlerData = [];
  if (routes.length === 0) {
    return nullMatcher;
  }
  const routesWithStaticPathFlag = routes.map(
    (route) => [!/\*|\/:/.test(route[0]), ...route]
  ).sort(
    ([isStaticA, pathA], [isStaticB, pathB]) => isStaticA ? 1 : isStaticB ? -1 : pathA.length - pathB.length
  );
  const staticMap = {};
  for (let i = 0, j = -1, len = routesWithStaticPathFlag.length; i < len; i++) {
    const [pathErrorCheckOnly, path, handlers] = routesWithStaticPathFlag[i];
    if (pathErrorCheckOnly) {
      staticMap[path] = [handlers.map(([h]) => [h, {}]), emptyParam];
    } else {
      j++;
    }
    let paramAssoc;
    try {
      paramAssoc = trie.insert(path, j, pathErrorCheckOnly);
    } catch (e) {
      throw e === PATH_ERROR ? new UnsupportedPathError(path) : e;
    }
    if (pathErrorCheckOnly) {
      continue;
    }
    handlerData[j] = handlers.map(([h, paramCount]) => {
      const paramIndexMap = {};
      paramCount -= 1;
      for (; paramCount >= 0; paramCount--) {
        const [key, value] = paramAssoc[paramCount];
        paramIndexMap[key] = value;
      }
      return [h, paramIndexMap];
    });
  }
  const [regexp, indexReplacementMap, paramReplacementMap] = trie.buildRegExp();
  for (let i = 0, len = handlerData.length; i < len; i++) {
    for (let j = 0, len2 = handlerData[i].length; j < len2; j++) {
      const map = handlerData[i][j]?.[1];
      if (!map) {
        continue;
      }
      const keys = Object.keys(map);
      for (let k = 0, len3 = keys.length; k < len3; k++) {
        map[keys[k]] = paramReplacementMap[map[keys[k]]];
      }
    }
  }
  const handlerMap = [];
  for (const i in indexReplacementMap) {
    handlerMap[i] = handlerData[indexReplacementMap[i]];
  }
  return [regexp, handlerMap, staticMap];
}
function findMiddleware(middleware, path) {
  if (!middleware) {
    return void 0;
  }
  for (const k of Object.keys(middleware).sort((a, b) => b.length - a.length)) {
    if (buildWildcardRegExp(k).test(path)) {
      return [...middleware[k]];
    }
  }
  return void 0;
}
var RegExpRouter = class {
  constructor() {
    this.name = "RegExpRouter";
    this.middleware = { [METHOD_NAME_ALL]: {} };
    this.routes = { [METHOD_NAME_ALL]: {} };
  }
  add(method, path, handler) {
    var _a;
    const { middleware, routes } = this;
    if (!middleware || !routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    if (methodNames.indexOf(method) === -1) {
      methodNames.push(method);
    }
    if (!middleware[method]) {
      ;
      [middleware, routes].forEach((handlerMap) => {
        handlerMap[method] = {};
        Object.keys(handlerMap[METHOD_NAME_ALL]).forEach((p) => {
          handlerMap[method][p] = [...handlerMap[METHOD_NAME_ALL][p]];
        });
      });
    }
    if (path === "/*") {
      path = "*";
    }
    const paramCount = (path.match(/\/:/g) || []).length;
    if (/\*$/.test(path)) {
      const re = buildWildcardRegExp(path);
      if (method === METHOD_NAME_ALL) {
        Object.keys(middleware).forEach((m) => {
          var _a2;
          (_a2 = middleware[m])[path] || (_a2[path] = findMiddleware(middleware[m], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || []);
        });
      } else {
        (_a = middleware[method])[path] || (_a[path] = findMiddleware(middleware[method], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || []);
      }
      Object.keys(middleware).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(middleware[m]).forEach((p) => {
            re.test(p) && middleware[m][p].push([handler, paramCount]);
          });
        }
      });
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(routes[m]).forEach(
            (p) => re.test(p) && routes[m][p].push([handler, paramCount])
          );
        }
      });
      return;
    }
    const paths = checkOptionalParameter(path) || [path];
    for (let i = 0, len = paths.length; i < len; i++) {
      const path2 = paths[i];
      Object.keys(routes).forEach((m) => {
        var _a2;
        if (method === METHOD_NAME_ALL || method === m) {
          (_a2 = routes[m])[path2] || (_a2[path2] = [
            ...findMiddleware(middleware[m], path2) || findMiddleware(middleware[METHOD_NAME_ALL], path2) || []
          ]);
          routes[m][path2].push([handler, paramCount - len + i + 1]);
        }
      });
    }
  }
  match(method, path) {
    clearWildcardRegExpCache();
    const matchers = this.buildAllMatchers();
    this.match = (method2, path2) => {
      const matcher = matchers[method2];
      const staticMatch = matcher[2][path2];
      if (staticMatch) {
        return staticMatch;
      }
      const match = path2.match(matcher[0]);
      if (!match) {
        return [[], emptyParam];
      }
      const index = match.indexOf("", 1);
      return [matcher[1][index], match];
    };
    return this.match(method, path);
  }
  buildAllMatchers() {
    const matchers = {};
    methodNames.forEach((method) => {
      matchers[method] = this.buildMatcher(method) || matchers[METHOD_NAME_ALL];
    });
    this.middleware = this.routes = void 0;
    return matchers;
  }
  buildMatcher(method) {
    const routes = [];
    let hasOwnRoute = method === METHOD_NAME_ALL;
    [this.middleware, this.routes].forEach((r) => {
      const ownRoute = r[method] ? Object.keys(r[method]).map((path) => [path, r[method][path]]) : [];
      if (ownRoute.length !== 0) {
        hasOwnRoute || (hasOwnRoute = true);
        routes.push(...ownRoute);
      } else if (method !== METHOD_NAME_ALL) {
        routes.push(
          ...Object.keys(r[METHOD_NAME_ALL]).map((path) => [path, r[METHOD_NAME_ALL][path]])
        );
      }
    });
    if (!hasOwnRoute) {
      return null;
    } else {
      return buildMatcherFromPreprocessedRoutes(routes);
    }
  }
};

// node_modules/hono/dist/router/smart-router/router.js
var SmartRouter = class {
  constructor(init) {
    this.name = "SmartRouter";
    this.routers = [];
    this.routes = [];
    Object.assign(this, init);
  }
  add(method, path, handler) {
    if (!this.routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    this.routes.push([method, path, handler]);
  }
  match(method, path) {
    if (!this.routes) {
      throw new Error("Fatal error");
    }
    const { routers, routes } = this;
    const len = routers.length;
    let i = 0;
    let res;
    for (; i < len; i++) {
      const router = routers[i];
      try {
        routes.forEach((args) => {
          router.add(...args);
        });
        res = router.match(method, path);
      } catch (e) {
        if (e instanceof UnsupportedPathError) {
          continue;
        }
        throw e;
      }
      this.match = router.match.bind(router);
      this.routers = [router];
      this.routes = void 0;
      break;
    }
    if (i === len) {
      throw new Error("Fatal error");
    }
    this.name = `SmartRouter + ${this.activeRouter.name}`;
    return res;
  }
  get activeRouter() {
    if (this.routes || this.routers.length !== 1) {
      throw new Error("No active router has been determined yet.");
    }
    return this.routers[0];
  }
};

// node_modules/hono/dist/router/trie-router/node.js
var Node2 = class {
  constructor(method, handler, children) {
    this.order = 0;
    this.params = {};
    this.children = children || {};
    this.methods = [];
    this.name = "";
    if (method && handler) {
      const m = {};
      m[method] = { handler, possibleKeys: [], score: 0, name: this.name };
      this.methods = [m];
    }
    this.patterns = [];
  }
  insert(method, path, handler) {
    this.name = `${method} ${path}`;
    this.order = ++this.order;
    let curNode = this;
    const parts = splitRoutingPath(path);
    const possibleKeys = [];
    const parentPatterns = [];
    for (let i = 0, len = parts.length; i < len; i++) {
      const p = parts[i];
      if (Object.keys(curNode.children).includes(p)) {
        parentPatterns.push(...curNode.patterns);
        curNode = curNode.children[p];
        const pattern2 = getPattern(p);
        if (pattern2) {
          possibleKeys.push(pattern2[1]);
        }
        continue;
      }
      curNode.children[p] = new Node2();
      const pattern = getPattern(p);
      if (pattern) {
        curNode.patterns.push(pattern);
        parentPatterns.push(...curNode.patterns);
        possibleKeys.push(pattern[1]);
      }
      parentPatterns.push(...curNode.patterns);
      curNode = curNode.children[p];
    }
    if (!curNode.methods.length) {
      curNode.methods = [];
    }
    const m = {};
    const handlerSet = {
      handler,
      possibleKeys: possibleKeys.filter((v, i, a) => a.indexOf(v) === i),
      name: this.name,
      score: this.order
    };
    m[method] = handlerSet;
    curNode.methods.push(m);
    return curNode;
  }
  gHSets(node, method, nodeParams, params) {
    const handlerSets = [];
    for (let i = 0, len = node.methods.length; i < len; i++) {
      const m = node.methods[i];
      const handlerSet = m[method] || m[METHOD_NAME_ALL];
      const processedSet = {};
      if (handlerSet !== void 0) {
        handlerSet.params = {};
        handlerSet.possibleKeys.forEach((key) => {
          const processed = processedSet[handlerSet.name];
          handlerSet.params[key] = params[key] && !processed ? params[key] : nodeParams[key] ?? params[key];
          processedSet[handlerSet.name] = true;
        });
        handlerSets.push(handlerSet);
      }
    }
    return handlerSets;
  }
  search(method, path) {
    const handlerSets = [];
    this.params = {};
    const curNode = this;
    let curNodes = [curNode];
    const parts = splitPath(path);
    for (let i = 0, len = parts.length; i < len; i++) {
      const part = parts[i];
      const isLast = i === len - 1;
      const tempNodes = [];
      for (let j = 0, len2 = curNodes.length; j < len2; j++) {
        const node = curNodes[j];
        const nextNode = node.children[part];
        if (nextNode) {
          nextNode.params = node.params;
          if (isLast === true) {
            if (nextNode.children["*"]) {
              handlerSets.push(...this.gHSets(nextNode.children["*"], method, node.params, {}));
            }
            handlerSets.push(...this.gHSets(nextNode, method, node.params, {}));
          } else {
            tempNodes.push(nextNode);
          }
        }
        for (let k = 0, len3 = node.patterns.length; k < len3; k++) {
          const pattern = node.patterns[k];
          const params = { ...node.params };
          if (pattern === "*") {
            const astNode = node.children["*"];
            if (astNode) {
              handlerSets.push(...this.gHSets(astNode, method, node.params, {}));
              tempNodes.push(astNode);
            }
            continue;
          }
          if (part === "") {
            continue;
          }
          const [key, name, matcher] = pattern;
          const child = node.children[key];
          const restPathString = parts.slice(i).join("/");
          if (matcher instanceof RegExp && matcher.test(restPathString)) {
            params[name] = restPathString;
            handlerSets.push(...this.gHSets(child, method, node.params, params));
            continue;
          }
          if (matcher === true || matcher instanceof RegExp && matcher.test(part)) {
            if (typeof key === "string") {
              params[name] = part;
              if (isLast === true) {
                handlerSets.push(...this.gHSets(child, method, params, node.params));
                if (child.children["*"]) {
                  handlerSets.push(...this.gHSets(child.children["*"], method, params, node.params));
                }
              } else {
                child.params = params;
                tempNodes.push(child);
              }
            }
          }
        }
      }
      curNodes = tempNodes;
    }
    const results = handlerSets.sort((a, b) => {
      return a.score - b.score;
    });
    return [results.map(({ handler, params }) => [handler, params])];
  }
};

// node_modules/hono/dist/router/trie-router/router.js
var TrieRouter = class {
  constructor() {
    this.name = "TrieRouter";
    this.node = new Node2();
  }
  add(method, path, handler) {
    const results = checkOptionalParameter(path);
    if (results) {
      for (const p of results) {
        this.node.insert(method, p, handler);
      }
      return;
    }
    this.node.insert(method, path, handler);
  }
  match(method, path) {
    return this.node.search(method, path);
  }
};

// node_modules/hono/dist/hono.js
var Hono2 = class extends Hono {
  constructor(options = {}) {
    super(options);
    this.router = options.router ?? new SmartRouter({
      routers: [new RegExpRouter(), new TrieRouter()]
    });
  }
};

// node_modules/hono/dist/utils/stream.js
var StreamingApi = class {
  constructor(writable, _readable) {
    this.abortSubscribers = [];
    this.writable = writable;
    this.writer = writable.getWriter();
    this.encoder = new TextEncoder();
    const reader = _readable.getReader();
    this.responseReadable = new ReadableStream({
      async pull(controller) {
        const { done, value } = await reader.read();
        done ? controller.close() : controller.enqueue(value);
      },
      cancel: () => {
        this.abortSubscribers.forEach((subscriber) => subscriber());
      }
    });
  }
  async write(input) {
    try {
      if (typeof input === "string") {
        input = this.encoder.encode(input);
      }
      await this.writer.write(input);
    } catch (e) {
    }
    return this;
  }
  async writeln(input) {
    await this.write(input + "\n");
    return this;
  }
  sleep(ms) {
    return new Promise((res) => setTimeout(res, ms));
  }
  async close() {
    try {
      await this.writer.close();
    } catch (e) {
    }
  }
  async pipe(body) {
    this.writer.releaseLock();
    await body.pipeTo(this.writable, { preventClose: true });
    this.writer = this.writable.getWriter();
  }
  async onAbort(listener) {
    this.abortSubscribers.push(listener);
  }
};

// node_modules/hono/dist/helper/streaming/stream.js
var stream = (c, cb) => {
  const { readable, writable } = new TransformStream();
  const stream2 = new StreamingApi(writable, readable);
  cb(stream2).finally(() => stream2.close());
  return c.newResponse(stream2.responseReadable);
};

// node_modules/hono/dist/helper/streaming/text.js
var streamText = (c, cb) => {
  c.header("Content-Type", TEXT_PLAIN);
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Transfer-Encoding", "chunked");
  return stream(c, cb);
};

// node_modules/eventsource-parser/dist/index.js
function createParser2(onParse) {
  let isFirstChunk;
  let buffer;
  let startingPosition;
  let startingFieldLength;
  let eventId;
  let eventName;
  let data;
  reset();
  return {
    feed,
    reset
  };
  function reset() {
    isFirstChunk = true;
    buffer = "";
    startingPosition = 0;
    startingFieldLength = -1;
    eventId = void 0;
    eventName = void 0;
    data = "";
  }
  function feed(chunk) {
    buffer = buffer ? buffer + chunk : chunk;
    if (isFirstChunk && hasBom2(buffer)) {
      buffer = buffer.slice(BOM2.length);
    }
    isFirstChunk = false;
    const length = buffer.length;
    let position = 0;
    let discardTrailingNewline = false;
    while (position < length) {
      if (discardTrailingNewline) {
        if (buffer[position] === "\n") {
          ++position;
        }
        discardTrailingNewline = false;
      }
      let lineLength = -1;
      let fieldLength = startingFieldLength;
      let character;
      for (let index = startingPosition; lineLength < 0 && index < length; ++index) {
        character = buffer[index];
        if (character === ":" && fieldLength < 0) {
          fieldLength = index - position;
        } else if (character === "\r") {
          discardTrailingNewline = true;
          lineLength = index - position;
        } else if (character === "\n") {
          lineLength = index - position;
        }
      }
      if (lineLength < 0) {
        startingPosition = length - position;
        startingFieldLength = fieldLength;
        break;
      } else {
        startingPosition = 0;
        startingFieldLength = -1;
      }
      parseEventStreamLine(buffer, position, fieldLength, lineLength);
      position += lineLength + 1;
    }
    if (position === length) {
      buffer = "";
    } else if (position > 0) {
      buffer = buffer.slice(position);
    }
  }
  function parseEventStreamLine(lineBuffer, index, fieldLength, lineLength) {
    if (lineLength === 0) {
      if (data.length > 0) {
        onParse({
          type: "event",
          id: eventId,
          event: eventName || void 0,
          data: data.slice(0, -1)
          // remove trailing newline
        });
        data = "";
        eventId = void 0;
      }
      eventName = void 0;
      return;
    }
    const noValue = fieldLength < 0;
    const field = lineBuffer.slice(index, index + (noValue ? lineLength : fieldLength));
    let step = 0;
    if (noValue) {
      step = lineLength;
    } else if (lineBuffer[index + fieldLength + 1] === " ") {
      step = fieldLength + 2;
    } else {
      step = fieldLength + 1;
    }
    const position = index + step;
    const valueLength = lineLength - step;
    const value = lineBuffer.slice(position, position + valueLength).toString();
    if (field === "data") {
      data += value ? "".concat(value, "\n") : "\n";
    } else if (field === "event") {
      eventName = value;
    } else if (field === "id" && !value.includes("\0")) {
      eventId = value;
    } else if (field === "retry") {
      const retry = parseInt(value, 10);
      if (!Number.isNaN(retry)) {
        onParse({
          type: "reconnect-interval",
          value: retry
        });
      }
    }
  }
}
var BOM2 = [239, 187, 191];
function hasBom2(buffer) {
  return BOM2.every((charCode, index) => buffer.charCodeAt(index) === charCode);
}

// node_modules/eventsource-parser/dist/stream.js
var EventSourceParserStream2 = class extends TransformStream {
  constructor() {
    let parser;
    super({
      start(controller) {
        parser = createParser2((event) => {
          if (event.type === "event") {
            controller.enqueue(event);
          }
        });
      },
      transform(chunk) {
        parser.feed(chunk);
      }
    });
  }
};

// src/index.js
var app = new Hono2();
app.post("/api/chat", async (c) => {
  const payload = await c.req.json();
  const ai = new Ai(c.env.AI);
  const messages = [...payload.messages];
  if (payload?.config?.systemMessage) {
    messages.unshift({ role: "system", content: payload.config.systemMessage });
  }
  console.log("Model", payload.config.model);
  console.log("Messages", JSON.stringify(messages));
  const eventSourceStream = await ai.run(payload.config.model, { messages, stream: true });
  const tokenStream = eventSourceStream.pipeThrough(new TextDecoderStream()).pipeThrough(new EventSourceParserStream2());
  return streamText(c, async (stream2) => {
    for await (const msg of tokenStream) {
      if (msg.data !== "[DONE]") {
        const data = JSON.parse(msg.data);
        stream2.write(data.response);
      }
    }
  });
});
app.get("/*", (c) => c.env.ASSETS.fetch(c.req.raw));
var src_default = app;
export {
  src_default as default
};
