/* no-ai-guard.js - 禁止接入外部 AI 系统，互动保持本地规则自主选择 */
(function() {
    var AI_ENDPOINT_PATTERNS = [
        /openai/i,
        /chatgpt/i,
        /api\.anthropic/i,
        /claude/i,
        /generativelanguage/i,
        /gemini/i,
        /deepseek/i,
        /zhipu/i,
        /bigmodel/i,
        /dashscope/i,
        /qwen/i,
        /kimi/i,
        /moonshot/i,
        /doubao/i,
        /volcengine.*ark/i,
        /ark.*volcengine/i,
        /cohere/i,
        /mistral/i,
        /huggingface.*inference/i
    ];

    function stringifyUrl(input) {
        try {
            if (typeof input === 'string') return input;
            if (input && input.url) return String(input.url);
            return String(input || '');
        } catch (e) {
            return '';
        }
    }

    function isAiEndpoint(input) {
        var url = stringifyUrl(input);
        return !!url && AI_ENDPOINT_PATTERNS.some(function(pattern) { return pattern.test(url); });
    }

    function blockAiEndpoint(input) {
        var url = stringifyUrl(input);
        console.warn('[no-ai-guard] 已阻止外部 AI 系统接入:', url);
        throw new Error('已禁止接入外部 AI 系统，梦角互动仅使用本地规则与本地内容库。');
    }

    window.__NO_AI_SYSTEM_ACCESS__ = true;
    window.__isBlockedAiEndpoint = isAiEndpoint;

    if (typeof window.fetch === 'function') {
        var nativeFetch = window.fetch.bind(window);
        window.fetch = function(input, init) {
            if (isAiEndpoint(input)) return Promise.reject(blockAiEndpoint(input));
            return nativeFetch(input, init);
        };
    }

    if (typeof window.XMLHttpRequest === 'function') {
        var NativeXHR = window.XMLHttpRequest;
        window.XMLHttpRequest = function() {
            var xhr = new NativeXHR();
            var nativeOpen = xhr.open;
            xhr.open = function(method, url) {
                if (isAiEndpoint(url)) blockAiEndpoint(url);
                return nativeOpen.apply(xhr, arguments);
            };
            return xhr;
        };
    }

    if (typeof window.WebSocket === 'function') {
        var NativeWebSocket = window.WebSocket;
        window.WebSocket = function(url, protocols) {
            if (isAiEndpoint(url)) blockAiEndpoint(url);
            return protocols === undefined ? new NativeWebSocket(url) : new NativeWebSocket(url, protocols);
        };
        window.WebSocket.prototype = NativeWebSocket.prototype;
    }

    if (typeof window.EventSource === 'function') {
        var NativeEventSource = window.EventSource;
        window.EventSource = function(url, config) {
            if (isAiEndpoint(url)) blockAiEndpoint(url);
            return new NativeEventSource(url, config);
        };
        window.EventSource.prototype = NativeEventSource.prototype;
    }
})();
