"use server";

const CONNECT_URL = "https://n8nbeta.typeflow.app.br/webhook/aeb30639-baf0-4862-9f5f-a3cc468ab7c5";
const STATUS_URL = "https://n8nbeta.typeflow.app.br/webhook/ef3b141f-ebd0-433c-bdfc-2fb112558ffd";
const DISCONNECT_URL = "https://n8nbeta.typeflow.app.br/webhook/2ac86d63-f7fc-4221-bbaf-efeecec33127";
const SEND_MESSAGE_URL = "https://n8nbeta.typeflow.app.br/webhook-test/235c79d0-71ed-4a43-aa3c-5c0cf1de2580";
const GROUP_WEBHOOK_URL = "https://n8nbeta.typeflow.app.br/webhook/9c5d6ca0-8469-48f3-9a40-115f4d712362";
const SEND_SCHEDULED_GROUP_MESSAGE_WITH_IMAGE_URL = "https://n8nbeta.typeflow.app.br/webhook/6b70ac73-9025-4ace-b7c9-24db23376c4c";


async function postRequest(url: string, body: any = {}, token?: string) {
  try {
    let requestBody = { ...body };
    
    // Send token in ALL requests, without exception.
    if (token) {
        requestBody.chave = token;
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });
    
    if (response.status === 429) {
      console.error("Error 429: Too Many Requests.", { url, responseStatus: response.status });
      throw new Error("Muitas tentativas. Por favor, aguarde um minuto e tente novamente.");
    }
    
    const jsonResponse = await response.json();
    console.log(`Response from ${url}:`, jsonResponse);
    
    if (!response.ok) {
        console.error(`Request to ${url} failed with status ${response.status}`, jsonResponse);
        throw new Error(jsonResponse.message || `Request failed with status ${response.status}`);
    }
    
    if (jsonResponse.status === 'error' || jsonResponse.message?.includes('error')) {
        console.error(`Application-level error from ${url}:`, jsonResponse.message);
        throw new Error(jsonResponse.message || 'The webhook returned an unspecified error.');
    }

    return jsonResponse;
  } catch (error) {
    console.error(`Request failed for URL: ${url}`, error);
    if (error instanceof Error) {
        throw new Error(error.message);
    }
    throw new Error("An unknown error occurred");
  }
}

export async function getQRCode(token?: string) {
  return postRequest(CONNECT_URL, {}, token);
}

export async function getStatus(token?: string) {
  return postRequest(STATUS_URL, {}, token);
}

export async function disconnect(token?: string) {
  return postRequest(DISCONNECT_URL, {}, token);
}

export async function sendMessage(phone: string, message: string, token?: string) {
    const formattedMessage = message.replace(/\n/g, '\\n');
    return postRequest(SEND_MESSAGE_URL, { numero: phone, mensagem: formattedMessage }, token);
}

export async function sendScheduledGroupMessageWithImage(groupId: string, message: string, imageBase64: string, token?: string) {
    const formattedMessage = message.replace(/\n/g, '\\n');
    return postRequest(SEND_SCHEDULED_GROUP_MESSAGE_WITH_IMAGE_URL, { numero: groupId, texto: formattedMessage, imagem: imageBase64 }, token);
}

export async function sendToGroupWebhook(groupCode: string, token?: string) {
    return postRequest(GROUP_WEBHOOK_URL, { groupCode }, token);
}

    