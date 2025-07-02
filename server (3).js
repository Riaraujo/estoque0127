const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// Configuração do MongoDB
const MONGO_URL = process.env.MONGO_URL || process.env.MONGO_PUBLIC_URL;
let db;

// Conectar ao MongoDB
async function connectToMongoDB() {
    try {
        const client = new MongoClient(MONGO_URL);
        await client.connect();
        db = client.db('sistemaProdutos');
        console.log('Conectado ao MongoDB com sucesso!');
        
        // Criar índices para melhor performance
        await db.collection('tabelaProdutos').createIndex({ codigoBarras: 1 });
        await db.collection('tabelaProdutos').createIndex({ rct: 1 });
        await db.collection('tabelaTotalDeProdutos').createIndex({ codigoBarras: 1 });
        
    } catch (error) {
        console.error('Erro ao conectar ao MongoDB:', error);
        process.exit(1);
    }
}

// Rota principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Rota para buscar produto por código de barras
app.get('/api/produto/:codigoBarras', async (req, res) => {
    try {
        const { codigoBarras } = req.params;
        const produto = await db.collection('tabelaTotalDeProdutos').findOne({ codigoBarras });
        
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
app.get('/api/produto/rct/:rct', async (req, res) => {
    try {
        const { rct } = req.params;
        const produtos = await db.collection('tabelaProdutos').find({ rct }).toArray();
        
        if (produtos.length > 0) {
            res.json(produtos);
        } else {
            res.status(404).json({ error: 'Produtos não encontrados para este RCT' });
        }
    } catch (error) {
        console.error('Erro ao buscar produtos por RCT:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Rota para adicionar produto
app.post('/api/produto', async (req, res) => {
    try {
        const { codigoBarras, rct, cabinet, prateleira } = req.body;
        
        // Verificar se o produto existe na tabela total
        const produtoTotal = await db.collection('tabelaTotalDeProdutos').findOne({ codigoBarras });
        
        if (!produtoTotal) {
            return res.status(404).json({ error: 'Produto não encontrado na base de dados' });
        }
        
        // Verificar se já existe um produto com mesmo código de barras na mesma localização
        const produtoExistente = await db.collection('tabelaProdutos').findOne({
            codigoBarras,
            cabinet,
            prateleira
        });
        
        if (produtoExistente) {
            return res.status(400).json({ error: 'Produto já existe nesta localização' });
        }
        
        // Criar novo produto na tabela de produtos
        const novoProduto = {
            codigoBarras,
            rct,
            cabinet,
            prateleira,
            nome: produtoTotal.nome,
            descricao: produtoTotal.descricao || '',
            dataAdicao: new Date()
        };
        
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

// Rota para remover produto
app.delete('/api/produto/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { ObjectId } = require('mongodb');
        
        const resultado = await db.collection('tabelaProdutos').deleteOne({ _id: new ObjectId(id) });
        
        if (resultado.deletedCount > 0) {
            res.json({ success: true, message: 'Produto removido com sucesso' });
        } else {
            res.status(404).json({ error: 'Produto não encontrado' });
        }
    } catch (error) {
        console.error('Erro ao remover produto:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Rota para buscar todos os produtos
app.get('/api/produtos', async (req, res) => {
    try {
        const produtos = await db.collection('tabelaProdutos').find({}).toArray();
        res.json(produtos);
    } catch (error) {
        console.error('Erro ao buscar produtos:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Rota para buscar produtos por cabinet
app.get('/api/produtos/cabinet/:cabinet', async (req, res) => {
    try {
        const { cabinet } = req.params;
        const produtos = await db.collection('tabelaProdutos').find({ cabinet }).toArray();
        res.json(produtos);
    } catch (error) {
        console.error('Erro ao buscar produtos por cabinet:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Rota para buscar produtos por cabinet e prateleira
app.get('/api/produtos/cabinet/:cabinet/prateleira/:prateleira', async (req, res) => {
    try {
        const { cabinet, prateleira } = req.params;
        const produtos = await db.collection('tabelaProdutos').find({ 
            cabinet, 
            prateleira 
        }).toArray();
        res.json(produtos);
    } catch (error) {
        console.error('Erro ao buscar produtos por localização:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Rota para adicionar produto à tabela total (para administração)
app.post('/api/produto-total', async (req, res) => {
    try {
        const { codigoBarras, nome, descricao } = req.body;
        
        // Verificar se já existe
        const produtoExistente = await db.collection('tabelaTotalDeProdutos').findOne({ codigoBarras });
        
        if (produtoExistente) {
            return res.status(400).json({ error: 'Produto já existe na base de dados' });
        }
        
        const novoProduto = {
            codigoBarras,
            nome,
            descricao: descricao || '',
            dataCriacao: new Date()
        };
        
        const resultado = await db.collection('tabelaTotalDeProdutos').insertOne(novoProduto);
        
        res.json({
            success: true,
            id: resultado.insertedId,
            produto: novoProduto
        });
        
    } catch (error) {
        console.error('Erro ao adicionar produto total:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Rota para buscar estatísticas
app.get('/api/estatisticas', async (req, res) => {
    try {
        const totalProdutos = await db.collection('tabelaProdutos').countDocuments();
        const totalProdutosCatalogo = await db.collection('tabelaTotalDeProdutos').countDocuments();
        
        // Produtos por cabinet
        const produtosPorCabinet = await db.collection('tabelaProdutos').aggregate([
            {
                $group: {
                    _id: '$cabinet',
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { _id: 1 }
            }
        ]).toArray();
        
        res.json({
            totalProdutos,
            totalProdutosCatalogo,
            produtosPorCabinet
        });
        
    } catch (error) {
        console.error('Erro ao buscar estatísticas:', error);
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

