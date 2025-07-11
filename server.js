const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração de CORS
const corsOptions = {
    origin: [
        'https://riaraujo.github.io',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:5500',
        'http://127.0.0.1:5500',
        'https://estoque0127-production.up.railway.app'
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

// Middleware para verificar conexão com o banco
async function checkDatabaseConnection(req, res, next) {
    try {
        if (!db) {
            return res.status(500).json({ error: 'Erro de conexão com o banco de dados' });
        }
        await db.admin().ping();
        next();
    } catch (error) {
        console.error('Erro de conexão com o banco:', error);
        return res.status(500).json({ error: 'Erro de conexão com o banco de dados' });
    }
}

// Rotas da API

// Rota de saúde do servidor
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        message: 'Servidor funcionando corretamente'
    });
});

// Rota para buscar produto por código
app.get('/api/produto/:codigo', checkDatabaseConnection, async (req, res) => {
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

// Rota para buscar produto por RCT
app.get('/api/produto/rct/:rct', checkDatabaseConnection, async (req, res) => {
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

// Rota para adicionar produto
app.post('/api/adicionar-produto', checkDatabaseConnection, async (req, res) => {
    try {
        const { codigo, localizacao } = req.body;
        
        if (!codigo || typeof codigo !== 'string' || codigo.trim() === '') {
            return res.status(400).json({ error: 'Código do produto é obrigatório' });
        }
        
        if (!localizacao || typeof localizacao !== 'string' || localizacao.trim() === '') {
            return res.status(400).json({ error: 'Localização é obrigatória' });
        }
        
        const produtoTotal = await db.collection('tabelaTotalDeProdutos').findOne({ codigo: codigo.trim() });
        
        if (!produtoTotal) {
            return res.status(404).json({ error: 'Produto não encontrado na tabela total' });
        }
        
        const novoProduto = {
            ...produtoTotal,
            localizacao: localizacao.trim(),
            dataAdicao: new Date()
        };
        
        const resultado = await db.collection('tabelaProdutos').insertOne(novoProduto);
        
        res.json({ 
            success: true, 
            id: resultado.insertedId,
            produto: novoProduto,
            message: 'Produto adicionado com sucesso'
        });
    } catch (error) {
        console.error('Erro ao adicionar produto:', error);
        res.status(500).json({ error: 'Erro interno do servidor: ' + error.message });
    }
});

// Rota para substituir produtos na prateleira
app.post('/api/substituir-produtos-prateleira', checkDatabaseConnection, async (req, res) => {
    const session = client.startSession();
    try {
        await session.withTransaction(async () => {
            const { produtos, localizacao } = req.body;
            
            if (!localizacao || typeof localizacao !== 'string') {
                throw { status: 400, message: 'Localização inválida' };
            }
            
            if (!Array.isArray(produtos)) {
                throw { status: 400, message: 'Produtos deve ser um array' };
            }

            const localizacaoTratada = localizacao.trim();
            
            const produtosParaAdicionar = [];
            for (const codigo of produtos) {
                const produto = await db.collection('tabelaTotalDeProdutos')
                    .findOne({ codigo }, { session });
                if (!produto) {
                    throw { status: 404, message: `Produto não encontrado: ${codigo}` };
                }
                produtosParaAdicionar.push({
                    ...produto,
                    localizacao: localizacaoTratada,
                    dataAdicao: new Date()
                });
            }

            await db.collection('tabelaProdutos')
                .deleteMany({ localizacao: localizacaoTratada }, { session });

            if (produtosParaAdicionar.length > 0) {
                await db.collection('tabelaProdutos')
                    .insertMany(produtosParaAdicionar, { session });
            }

            res.json({
                success: true,
                localizacao: localizacaoTratada,
                produtosAdicionados: produtosParaAdicionar.length,
                message: produtosParaAdicionar.length > 0
                    ? `Produtos atualizados na prateleira ${localizacaoTratada}`
                    : `Prateleira ${localizacaoTratada} esvaziada`
            });
        });
    } catch (error) {
        console.error('Erro:', error);
        const status = error.status || 500;
        const message = error.message || 'Erro interno do servidor';
        res.status(status).json({ error: message });
    } finally {
        await session.endSession();
    }
});

// Rota para buscar produtos por localização
app.get('/api/produtos/localizacao/:localizacao', checkDatabaseConnection, async (req, res) => {
    try {
        const { localizacao } = req.params;
        const produtos = await db.collection('tabelaProdutos').find({ localizacao }).toArray();
        res.json(produtos);
    } catch (error) {
        console.error('Erro ao buscar produtos por localização:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Rota para buscar todos os produtos
app.get('/api/produtos', checkDatabaseConnection, async (req, res) => {
    try {
        const produtos = await db.collection('tabelaProdutos').find({}).toArray();
        res.json(produtos);
    } catch (error) {
        console.error('Erro ao buscar produtos:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Rota para buscar todos os produtos totais
app.get('/api/produtos-total', checkDatabaseConnection, async (req, res) => {
    try {
        const produtos = await db.collection('tabelaTotalDeProdutos').find({}).toArray();
        res.json(produtos);
    } catch (error) {
        console.error('Erro ao buscar produtos totais:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Rota para remover produto
app.delete('/api/produto/:id', checkDatabaseConnection, async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'ID inválido' });
        }
        
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

// Rota para atualizar localização
app.put('/api/produto/:id/localizacao', checkDatabaseConnection, async (req, res) => {
    try {
        const { id } = req.params;
        const { localizacao } = req.body;
        
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'ID inválido' });
        }
        
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

// Rota para buscar produto completo
app.get('/api/buscar/:codigo', checkDatabaseConnection, async (req, res) => {
    try {
        const { codigo } = req.params;
        const produtosEstoque = await db.collection('tabelaProdutos').find({ codigo }).toArray();
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

// Rota para buscar por RCT
app.get('/api/buscar/rct/:rct', checkDatabaseConnection, async (req, res) => {
    try {
        const { rct } = req.params;
        const produtoTotal = await db.collection('tabelaTotalDeProdutos').findOne({ rct });
        
        if (!produtoTotal) {
            return res.status(404).json({ error: 'Produto não encontrado' });
        }
        
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

// Rotas para servir arquivos estáticos
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/:filename', (req, res) => {
    const filename = req.params.filename;
    if (filename.endsWith('.html') || filename.endsWith('.css') || filename.endsWith('.js') || 
        filename.endsWith('.png') || filename.endsWith('.jpg') || filename.endsWith('.jpeg')) {
        res.sendFile(path.join(__dirname, 'public', filename));
    } else {
        res.status(404).send('Arquivo não encontrado');
    }
});

// Middleware de tratamento de erros
app.use((error, req, res, next) => {
    console.error('Erro não tratado:', error);
    res.status(500).json({ 
        error: 'Erro interno do servidor',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
});

// Iniciar servidor
async function startServer() {
    await connectToMongoDB();
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Servidor rodando na porta ${PORT}`);
        console.log(`Acesse: http://localhost:${PORT}`);
    });
}

// Tratamento de encerramento
process.on('SIGINT', async () => {
    console.log('Encerrando servidor...');
    if (client) await client.close();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('Encerrando servidor...');
    if (client) await client.close();
    process.exit(0);
});

startServer().catch(console.error);
