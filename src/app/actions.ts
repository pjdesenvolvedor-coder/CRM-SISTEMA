"use server";

const CONNECT_URL = "https://n8nbeta.typeflow.app.br/webhook/aeb30639-baf0-4862-9f5f-a3cc468ab7c5";
const STATUS_URL = "https://n8nbeta.typeflow.app.br/webhook/ef3b141f-ebd0-433c-bdfc-2fb112558ffd";
const DISCONNECT_URL = "https://n8nbeta.typeflow.app.br/webhook/2ac86d63-f7fc-4221-bbaf-efeecec33127";
const SEND_MESSAGE_URL = "https://n8nbeta.typeflow.app.br/webhook/235c79d0-71ed-4a43-aa3c-5c0cf1de2580";
const GROUP_WEBHOOK_URL = "https://n8nbeta.typeflow.app.br/webhook/9c5d6ca0-8469-48f3-9a40-115f4d712362";
const SEND_GROUP_MESSAGE_URL = "https://n8nbeta.typeflow.app.br/webhook/9d074934-62ca-40b0-a31a-00fab0e04388";
const SEND_SCHEDULED_GROUP_MESSAGE_WITH_IMAGE_URL = "https://n8nbeta.typeflow.app.br/webhook/6b70ac73-9025-4ace-b7c9-24db23376c4c";


async function postRequest(url: string, body: any = {}) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: 'no-store', // Força a Vercel a não fazer cache
      next: { revalidate: 1 } // Força a Vercel a não fazer cache
    });

    // Se a resposta estiver vazia, retorne sucesso sem tentar fazer o parse
    if (response.status === 200 && !response.headers.get('content-length')) {
      return { status: 'ok' };
    }

    const jsonResponse = await response.json();

    if (!response.ok) {
      throw new Error(jsonResponse.message || `Request failed with status ${response.status}`);
    }
    
    // Verificando se a resposta da n8n indica um erro
    if (jsonResponse.status === 'error' || jsonResponse.message?.includes('error')) {
      throw new Error(jsonResponse.message || 'The webhook returned an unspecified error.');
    }

    return jsonResponse;
  } catch (error) {
    console.error("Request failed:", error);
    if (error instanceof Error) {
        throw new Error(error.message);
    }
    throw new Error("An unknown error occurred");
  }
}

export async function getQRCode() {
  return postRequest(CONNECT_URL);
}

export async function getStatus() {
  return postRequest(STATUS_URL);
}

export async function disconnect() {
  return postRequest(DISCONNECT_URL);
}

export async function sendMessage(phone: string, message: string) {
    const formattedMessage = message.replace(/\n/g, '\\n');
    return postRequest(SEND_MESSAGE_URL, { numero: phone, mensagem: formattedMessage });
}

export async function sendGroupMessage(phone: string, message: string) {
    const formattedMessage = message.replace(/\n/g, '\\n');
    return postRequest(SEND_GROUP_MESSAGE_URL, { numero: phone, mensagem: formattedMessage });
}

export async function sendScheduledGroupMessageWithImage(groupId: string, message: string, imageBase64: string) {
    const formattedMessage = message.replace(/\n/g, '\\n');
    return postRequest(SEND_SCHEDULED_GROUP_MESSAGE_WITH_IMAGE_URL, { numero: groupId, texto: formattedMessage, imagem: imageBase64 });
}

export async function sendToGroupWebhook(groupCode: string) {
    return postRequest(GROUP_WEBHOOK_URL, { groupCode });
}
