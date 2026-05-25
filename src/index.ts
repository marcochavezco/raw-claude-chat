async function chat(message: string) {
  const URL = `https://api.anthropic.com/v1/messages`;

  try {
    const res = await fetch(URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': `${process.env.ANTHROPIC_API_KEY}`,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: 'Hello Claude',
          },
        ],
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(JSON.stringify(data));
    }

    return data;
  } catch (error: any) {
    return console.error(error.message);
  }
}

async function main() {
  const response = await chat('test');
  console.log(response.content[0].text);
}

main();
