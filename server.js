const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração de CORS mais permissiva para GitHub Pages
const corsOptions = {
    origin: [
        'https://riaraujo.github.io',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:5500',
        'http://127.0.0.1:5500'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configuração do MongoDB
const MONGO_URI = process.env.MONGO_URL || process.env.MONGO_PUBLIC_URL;
const DB_NAME = 'estoque_db';

let db;
let client;

// Conectar ao MongoDB
async function connectToMongoDB() {
    try {
        client = new MongoClient(MONGO_URI);
        await client.connect();
        db = client.db(DB_NAME);
        console.log('Conectado ao MongoDB com sucesso!');
        
        // Inicializar dados se necessário
        await initializeData();
    } catch (error) {
        console.error('Erro ao conectar ao MongoDB:', error);
        process.exit(1);
    }
}

// Inicializar dados padrão
async function initializeData() {
    try {
        const tabelaTotalCollection = db.collection('tabelaTotalDeProdutos');
        const count = await tabelaTotalCollection.countDocuments();
        
        if (count === 0) {
            const produtosPadrao = [
                {
                    codigo: "4066756633288",
                    rct: "002760MWTPPT44",
                    precoPromocao: 100.00,
                    precoTabela: 349.99,
                    saldo: 5,
                    localizacao: ""
                },
                {
                    codigo: "0196464441616",
                    rct: "100000103FSHBC34",
                    precoPromocao: 399.99,
                    precoTabela: 499.99,
                    saldo: null,
                    localizacao: ""
                },
                {
                    codigo: "0054871712197",
                    rct: "002240WFSHPT34",
                    precoPromocao: 0.00,
                    precoTabela: 499.99,
                    saldo: null,
                    localizacao: ""
                },
                {
                    codigo: "0054871712203",
                    rct: "002240WFSHPT35",
                    precoPromocao: 0.00,
                    precoTabela: 499.99,
                    saldo: null,
                    localizacao: ""
                },
                {
                    codigo: "0054871712227",
                    rct: "002240WFSHPT36",
                    precoPromocao: 0.00,
                    precoTabela: 499.99,
                    saldo: null,
                    localizacao: ""
                },
                {
                    codigo: "0054871712234",
                    rct: "meu ovo",
                    precoPromocao: 6.00,
                    precoTabela: 49.99,
                    saldo: 8888,
                    localizacao: ""
                },
                {
                    codigo: "0054871712241",
                    rct: "002240WFSHPT38",
                    precoPromocao: 0.00,
                    precoTabela: 499.99,
                    saldo: null,
                    localizacao: ""
                },
                {
                    codigo: "0054871712258",
                    rct: "002240WFSHPT39",
                    precoPromocao: 0.00,
                    precoTabela: 499.99,
                    saldo: null,
                    localizacao: ""
                }
            ];
            
            await tabelaTotalCollection.insertMany(produtosPadrao);
            console.log('Dados iniciais inseridos na tabelaTotalDeProdutos');
        }
    } catch (error) {
        console.error('Erro ao inicializar dados:', error);
    }
}

// Middleware para log de requisições
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - Origin: ${req.get('Origin')}`);
    next();
});

// Rotas da API

// Rota de teste para verificar se o servidor está funcionando
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        message: 'Servidor funcionando corretamente'
    });
});

// Rota para buscar produto por código na tabela total
app.get('/api/produto/:codigo', async (req, res) => {
    try {
        const { codigo } = req.params;
        const produto = await db.collection('tabelaTotalDeProdutos').findOne({ codigo });
        
        if (produto) {
            res.json(produto);
        } else {
            res.status(404).json({ error: 'Produto não encontrado' });
        }
    } catch (error) {
        console.error('Erro ao buscar produto:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Rota para buscar produto por RCT na tabela total
app.get('/api/produto/rct/:rct', async (req, res) => {
    try {
        const { rct } = req.params;
        const produto = await db.collection('tabelaTotalDeProdutos').findOne({ rct });
        
        if (produto) {
            res.json(produto);
        } else {
            res.status(404).json({ error: 'Produto não encontrado' });
        }
    } catch (error) {
        console.error('Erro ao buscar produto por RCT:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Rota para adicionar produto à tabelaProdutos
app.post('/api/adicionar-produto', async (req, res) => {
    try {
        const { codigo, localizacao } = req.body;
        
        // Buscar produto na tabela total
        const produtoTotal = await db.collection('tabelaTotalDeProdutos').findOne({ codigo });
        
        if (!produtoTotal) {
            return res.status(404).json({ error: 'Produto não encontrado na tabela total' });
        }
        
        // Criar novo produto para a tabela de produtos
        const novoProduto = {
            ...produtoTotal,
            localizacao,
            dataAdicao: new Date()
        };
        
        // Inserir na tabelaProdutos
        const resultado = await db.collection('tabelaProdutos').insertOne(novoProduto);
        
        res.json({ 
            success: true, 
            id: resultado.insertedId,
            produto: novoProduto 
        });
    } catch (error) {
        console.error('Erro ao adicionar produto:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Rota para buscar produtos por localização
app.get('/api/produtos/localizacao/:localizacao', async (req, res) => {
    try {
        const { localizacao } = req.params;
        const produtos = await db.collection('tabelaProdutos').find({ localizacao }).toArray();
        res.json(produtos);
    } catch (error) {
        console.error('Erro ao buscar produtos por localização:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Rota para buscar todos os produtos da tabelaProdutos
app.get('/api/produtos', async (req, res) => {
    try {
        const produtos = await db.collection('tabelaProdutos').find({}).toArray();
        res.json(produtos);
    } catch (error) {
        console.error('Erro ao buscar produtos:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Rota para buscar todos os produtos da tabelaTotalDeProdutos
app.get('/api/produtos-total', async (req, res) => {
    try {
        const produtos = await db.collection('tabelaTotalDeProdutos').find({}).toArray();
        res.json(produtos);
    } catch (error) {
        console.error('Erro ao buscar produtos totais:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Rota para remover produto da tabelaProdutos
app.delete('/api/produto/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { ObjectId } = require('mongodb');
        
        const resultado = await db.collection('tabelaProdutos').deleteOne({ _id: new ObjectId(id) });
        
        if (resultado.deletedCount === 1) {
            res.json({ success: true, message: 'Produto removido com sucesso' });
        } else {
            res.status(404).json({ error: 'Produto não encontrado' });
        }
    } catch (error) {
        console.error('Erro ao remover produto:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Rota para atualizar localização de um produto
app.put('/api/produto/:id/localizacao', async (req, res) => {
    try {
        const { id } = req.params;
        const { localizacao } = req.body;
        const { ObjectId } = require('mongodb');
        
        const resultado = await db.collection('tabelaProdutos').updateOne(
            { _id: new ObjectId(id) },
            { $set: { localizacao, dataAtualizacao: new Date() } }
        );
        
        if (resultado.matchedCount === 1) {
            res.json({ success: true, message: 'Localização atualizada com sucesso' });
        } else {
            res.status(404).json({ error: 'Produto não encontrado' });
        }
    } catch (error) {
        console.error('Erro ao atualizar localização:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Rota para buscar produtos por código de barras (múltiplos resultados)
app.get('/api/buscar/:codigo', async (req, res) => {
    try {
        const { codigo } = req.params;
        
        // Buscar na tabela de produtos (produtos já adicionados ao estoque)
        const produtosEstoque = await db.collection('tabelaProdutos').find({ codigo }).toArray();
        
        // Buscar na tabela total (informações do produto)
        const produtoTotal = await db.collection('tabelaTotalDeProdutos').findOne({ codigo });
        
        res.json({
            produtoTotal,
            produtosEstoque,
            quantidadeEstoque: produtosEstoque.length
        });
    } catch (error) {
        console.error('Erro ao buscar produto:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Rota para buscar produtos por RCT (múltiplos resultados)
app.get('/api/buscar/rct/:rct', async (req, res) => {
    try {
        const { rct } = req.params;
        
        // Buscar na tabela total primeiro
        const produtoTotal = await db.collection('tabelaTotalDeProdutos').findOne({ rct });
        
        if (!produtoTotal) {
            return res.status(404).json({ error: 'Produto não encontrado' });
        }
        
        // Buscar na tabela de produtos usando o código
        const produtosEstoque = await db.collection('tabelaProdutos').find({ codigo: produtoTotal.codigo }).toArray();
        
        res.json({
            produtoTotal,
            produtosEstoque,
            quantidadeEstoque: produtosEstoque.length
        });
    } catch (error) {
        console.error('Erro ao buscar produto por RCT:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Rota para servir o arquivo HTML principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Rota para servir arquivos estáticos
app.get('/:filename', (req, res) => {
    const filename = req.params.filename;
    if (filename.endsWith('.html') || filename.endsWith('.css') || filename.endsWith('.js') || filename.endsWith('.png') || filename.endsWith('.jpg') || filename.endsWith('.jpeg')) {
        res.sendFile(path.join(__dirname, filename));
    } else {
        res.status(404).send('Arquivo não encontrado');
    }
});

// Middleware de tratamento de erros
app.use((error, req, res, next) => {
    console.error('Erro não tratado:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
});

// Iniciar servidor
async function startServer() {
    await connectToMongoDB();
    
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Servidor rodando na porta ${PORT}`);
        console.log(`Acesse: http://localhost:${PORT}`);
        console.log(`CORS configurado para GitHub Pages: https://riaraujo.github.io`);
    });
}

// Tratamento de encerramento gracioso
process.on('SIGINT', async () => {
    console.log('Encerrando servidor...');
    if (client) {
        await client.close();
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('Encerrando servidor...');
    if (client) {
        await client.close();
    }
    process.exit(0);
});

startServer().catch(console.error);
