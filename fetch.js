const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const getData = async () => {
  // fetch data with form data and return it
  const formData = new URLSearchParams();
  formData.append('login', 'Demo');
  formData.append('password', 'DemoKairete2022@');
  const response = await fetch('https://www.kairete.net/api/auth', {
    method: 'POST',
    headers: {
      'XF-Api-Key': 'Bj-iF2DqxqJcBEolg9H6Qjp94ekWVM1Y',
    },
    body: formData,
  });
  // const response = await fetch('https://jsonplaceholder.typicode.com/todos/1');
  const data = await response.json();
  console.log(data);
};

getData();