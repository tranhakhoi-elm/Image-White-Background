async function test() {
  const url = "https://elmich.vn/wp-content/uploads/2024/05/Noi-Trimax-XR_01-1.jpg";
  const proxies = [
    url,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
    `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
    `https://wsrv.nl/?url=${encodeURIComponent(url)}` // note wsrv using url parameter
  ];
  for (const proxy of proxies) {
    try {
      console.log('Fetching', proxy);
      const res = await fetch(proxy);
      console.log('Status', res.status, res.headers.get('content-type'));
    } catch(e) {
      console.log('Error', e.message);
    }
  }
}
test();
