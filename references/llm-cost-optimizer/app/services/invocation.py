from app.core.schemas import LLMRequest, ModelProfile, ModelResponse, ProviderConnection
from app.services.client_factory import OpenAIClientFactory


class ModelInvoker:
    def __init__(self, client_factory: OpenAIClientFactory):
        self.client_factory = client_factory

    def invoke(
        self,
        connection: ProviderConnection,
        model: ModelProfile,
        request: LLMRequest,
    ) -> ModelResponse:
        client = self.client_factory.create(connection)

        messages = []
        if request.system_prompt:
            messages.append({"role": "system", "content": request.system_prompt})

        user_content = request.user_prompt
        if request.context:
            user_content = f"{request.context}\n\n{request.user_prompt}"
        messages.append({"role": "user", "content": user_content})

        response = client.chat.completions.create(
            model=model.model_id,
            messages=messages,
            max_tokens=request.max_output_tokens,
        )
        usage = response.usage
        input_tokens = int(getattr(usage, "prompt_tokens", 0) or 0)
        output_tokens = int(getattr(usage, "completion_tokens", 0) or 0)
        total_tokens = int(
            getattr(usage, "total_tokens", input_tokens + output_tokens) or 0
        )

        return ModelResponse(
            request_id=request.request_id,
            model_id=model.model_id,
            content=response.choices[0].message.content or "",
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=total_tokens,
        )
