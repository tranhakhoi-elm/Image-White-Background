async function test() {
  const url = "https://elmich.vn/wp-content/uploads/2024/05/Noi-Trimax-XR_01-1.jpg";
  const proxies = [
    `https://wsrv.nl/?url=${encodeURIComponent(url)}`,
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
  ];
  for (const proxy of proxies) {
    try {
      console.log('Fetching', proxy);
      const res = await fetch(proxy);
      console.log('Status', res.status, res.headers.get('content-type'), res.headers.get('access-control-allow-origin'));
    } catch(e) {
      console.log('Error', e.message);
    }
  }
}
test();
