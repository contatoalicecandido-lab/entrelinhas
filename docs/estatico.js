// Demonstração pública (GitHub Pages): reproduz os exemplos e as gravações de
// checagens reais, sem servidor e sem chaves. Usado só em docs/.
(() => {
  const norm = v => String(v ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  let status = null;
  const carregar = async () => (status ??= await (await fetch("dados/status.json")).json());
  window.ENTRELINHAS_API = {
    estatico: true,
    status: carregar,
    async verificar({ texto, modo }) {
      const st = await carregar();
      const t = norm(texto);
      const gravacao = (st.gravacoes ?? []).find(g => norm(g.texto) === t);
      const exemplo = (st.exemplos ?? []).find(e => norm(e.texto) === t);
      const alvo = modo === "real" ? (gravacao ?? exemplo) : (exemplo ?? gravacao);
      if (!alvo) {
        throw new Error("This public demo replays recorded checks. Pick one of the buttons above, or run Entrelinhas locally with Tavily and Bifrost keys to check any text (see the GitHub README).");
      }
      await new Promise(r => setTimeout(r, 1200));
      const dados = await (await fetch(alvo.arquivo)).json();
      if (alvo === gravacao) dados.gravacao = { data: gravacao.data };
      return dados;
    }
  };
})();
