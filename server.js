const express = require('express');
const cors = require('cors');
const ogs = require('open-graph-scraper');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const app = express();
// ALTERAÇÃO 1: Usa a porta que o Render fornecer ou a 3000 por padrão
const PORT = process.env.PORT || 3000;

const CAMINHO_DADOS = path.join(__dirname, 'dados_painel.json');

app.use(cors());
app.use(express.json({ limit: '10mb' })); // Aumentado o limite para aceitar imagens em texto se necessário

// ALTERAÇÃO 2: Permite que o servidor sirva o arquivo index.html e seus estilos na raiz do link
app.use(express.static(__dirname));

// ALTERAÇÃO 3: Rota principal que entrega o visual do painel quando você acessa o link do Render
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Função auxiliar para garantir que o ficheiro de banco de dados exista
function lerFicheiroDados() {
    if (!fs.existsSync(CAMINHO_DADOS)) {
        const dadosIniciais = { clientes: [], financas: [] };
        fs.writeFileSync(CAMINHO_DADOS, JSON.stringify(dadosIniciais, null, 2));
        return dadosIniciais;
    }
    const conteudo = fs.readFileSync(CAMINHO_DADOS, 'utf-8');
    return JSON.parse(conteudo || '{"clientes":[]"financas":[]}');
}

// 1. ROTA DE RASPAGEM ATUALIZADA (CONVERTE FOTO PARA BASE64)
app.post('/api/scrape', async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'Por favor, envie uma URL válida.' });
    }

    try {
        const options = { url: url };
        const { result } = await ogs(options);

        // Monta o objeto com os dados principais obtidos automaticamente
        const dadosDoCanal = {
            titulo: result.ogTitle || result.twitterTitle || 'Página Sem Nome',
            imagem: result.ogImage?.url || result.twitterImage?.url || 'https://via.placeholder.com/150',
            link: url
        };

        // Devolve os dados limpos para o seu painel visual
        return res.json(dadosDoCanal);

    } catch (error) {
        console.error('Erro ao buscar metadados:', error);
        return res.status(500).json({ error: 'Não foi possível ler os dados desse link automaticamente.' });
    }
});

// ROTA PROXY DE IMAGEM - CORREÇÃO DO BLOQUEIO DE FOTOS DO YOUTUBE
app.get('/api/proxy-imagem', async (req, res) => {
    const urlImagem = req.query.url;
    if (!urlImagem) {
        return res.status(400).send('URL da imagem em falta.');
    }

    try {
        const resposta = await axios({
            method: 'get',
            url: urlImagem,
            responseType: 'stream',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        // Passa o tipo de conteúdo original (ex: image/jpeg ou image/png)
        res.setHeader('Content-Type', resposta.headers['content-type'] || 'image/jpeg');
        resposta.data.pipe(res);
    } catch (erro) {
        console.error('Erro no proxy de imagem:', erro.message);
        res.status(500).send('Erro ao carregar imagem.');
    }
});

// 2. ROTA PARA OBTER TODOS OS DADOS SALVOS
app.get('/api/dados', (req, res) => {
    try {
        const dados = lerFicheiroDados();
        return res.json(dados);
    } catch (error) {
        return res.status(500).json({ error: 'Erro ao ler dados do servidor.' });
    }
});

// 3. ROTA PARA SALVAR TODOS OS DADOS
app.post('/api/salvar', (req, res) => {
    const { clientes, financas } = req.body;

    try {
        const dadosParaSalvar = {
            clientes: clientes || [],
            financas: financas || []
        };
        fs.writeFileSync(CAMINHO_DADOS, JSON.stringify(dadosParaSalvar, null, 2));
        return res.json({ success: true, message: 'Dados gravados com sucesso!' });
    } catch (error) {
        console.error('Erro ao salvar dados:', error);
        return res.status(500).json({ error: 'Erro ao salvar dados no servidor.' });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});