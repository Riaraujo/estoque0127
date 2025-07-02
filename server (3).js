const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// Configuração do MongoDB
const MONGO_URL = process.env.MONGO_URL || process.env.MONGO_PUBLIC_URL;
const client = new MongoClient(MONGO_URL);

let db;

// Conectar ao MongoDB
async function connectToMongoDB() {
    try {
        await client.connect();
        db = client.db('sistema_estoque');
        console.log('Conectado ao MongoDB com sucesso!');
        
        // Criar índices para melhor performance
        await db.collection('tabelaTotalDeProdutos').createIndex({ codigo: 1 });
        await db.collection('tabelaTotalDeProdutos').createIndex({ nome: 1 });
        await db.collection('tabelaProdutos').createIndex({ codigo: 1 });
        await db.collection('tabelaProdutos').createIndex({ rct: 1 });
        
    } catch (error) {
        console.error('Erro ao conectar ao MongoDB:', error);
        process.exit(1);
    }
}

// Rota para servir o index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Rota para servir o adicionar.html
app.get('/adicionar', (req, res) => {
    res.sendFile(path.join(__dirname, 'adicionar.html'));
});

// Buscar produto por código na tabela total
app.get('/api/produto/:codigo', async (req, res) => {
    try {
        const codigo = req.params.codigo;
        const produto = await db.collection('tabelaTotalDeProdutos').findOne({ codigo: codigo });
        
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

// Buscar produtos no estoque
app.get('/api/estoque', async (req, res) => {
    try {
        const produtos = await db.collection('tabelaProdutos').find({}).toArray();
        res.json(produtos);
    } catch (error) {
        console.error('Erro ao buscar estoque:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Buscar produto no estoque por código
app.get('/api/estoque/:codigo', async (req, res) => {
    try {
        const codigo = req.params.codigo;
        const produtos = await db.collection('tabelaProdutos').find({ codigo: codigo }).toArray();
        res.json(produtos);
    } catch (error) {
        console.error('Erro ao buscar produto no estoque:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Buscar produto no estoque por RCT
app.get('/api/estoque/rct/:rct', async (req, res) => {
    try {
        const rct = req.params.rct;
        const produto = await db.collection('tabelaProdutos').findOne({ rct: rct });
        
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

// Buscar produtos por nome
app.get('/api/buscar/:termo', async (req, res) => {
    try {
        const termo = req.params.termo;
        const regex = new RegExp(termo, 'i');
        
        // Buscar na tabela total de produtos
        const produtosTotal = await db.collection('tabelaTotalDeProdutos').find({
            $or: [
                { nome: regex },
                { codigo: regex }
            ]
        }).toArray();
        
        // Buscar no estoque
        const produtosEstoque = await db.collection('tabelaProdutos').find({
            $or: [
                { nome: regex },
                { codigo: regex },
                { rct: regex }
            ]
        }).toArray();
        
        res.json({
            produtosTotal: produtosTotal,
            produtosEstoque: produtosEstoque
        });
    } catch (error) {
        console.error('Erro ao buscar produtos:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Adicionar produto ao estoque
app.post('/api/adicionar', async (req, res) => {
    try {
        const { codigo, cabinet, prateleira, rct } = req.body;
        
        // Verificar se o produto existe na tabela total
        const produtoTotal = await db.collection('tabelaTotalDeProdutos').findOne({ codigo: codigo });
        
        if (!produtoTotal) {
            return res.status(404).json({ error: 'Produto não encontrado na tabela total de produtos' });
        }
        
        // Verificar se já existe produto nesta localização
        const produtoExistente = await db.collection('tabelaProdutos').findOne({
            cabinet: cabinet,
            prateleira: prateleira
        });
        
        if (produtoExistente) {
            return res.status(400).json({ error: 'Já existe um produto nesta localização' });
        }
        
        // Criar o produto no estoque
        const produtoEstoque = {
            codigo: codigo,
            nome: produtoTotal.nome,
            cabinet: cabinet,
            prateleira: prateleira,
            rct: rct,
            dataAdicao: new Date()
        };
        
        const resultado = await db.collection('tabelaProdutos').insertOne(produtoEstoque);
        
        res.json({
            success: true,
            id: resultado.insertedId,
            produto: produtoEstoque
        });
        
    } catch (error) {
        console.error('Erro ao adicionar produto:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Remover produto do estoque
app.delete('/api/remover/:id', async (req, res) => {
    try {
        const { ObjectId } = require('mongodb');
        const id = req.params.id;
        
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

// Verificar localização disponível
app.get('/api/localizacao/:cabinet/:prateleira', async (req, res) => {
    try {
        const { cabinet, prateleira } = req.params;
        
        const produto = await db.collection('tabelaProdutos').findOne({
            cabinet: cabinet,
            prateleira: prateleira
        });
        
        res.json({
            disponivel: !produto,
            produto: produto || null
        });
    } catch (error) {
        console.error('Erro ao verificar localização:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Inicializar servidor
async function startServer() {
    await connectToMongoDB();
    
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Servidor rodando na porta ${PORT}`);
        console.log(`Acesse: http://localhost:${PORT}`);
    });
}

startServer().catch(console.error);

