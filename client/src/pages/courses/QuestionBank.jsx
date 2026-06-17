import React, { useState, useEffect } from 'react'
import { Table, Button, Tag, Select, Space, Card, Modal, Form, Input, Radio, message, Popconfirm, InputNumber } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import request from '../../utils/request'

const { Option } = Select
const { TextArea } = Input

export default function QuestionBank() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState([])
  const [modalVisible, setModalVisible] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [form] = Form.useForm()
  const [course, setCourse] = useState(null)

  useEffect(() => {
    loadData()
    loadCourse()
  }, [id])

  const loadCourse = async () => {
    try {
      const res = await request.get(`/courses/${id}`)
      setCourse(res.data)
    } catch (e) {}
  }

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await request.get('/exams/questions', { params: { course_id: id } })
      setData(res.data || [])
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = () => {
    setEditingItem(null)
    form.resetFields()
    form.setFieldsValue({ type: 'single', score: 10 })
    setModalVisible(true)
  }

  const handleEdit = (item) => {
    setEditingItem(item)
    form.setFieldsValue({
      ...item,
      options: item.options || []
    })
    setModalVisible(true)
  }

  const handleDelete = async (qid) => {
    try {
      await request.delete(`/exams/questions/${qid}`)
      message.success('删除成功')
      loadData()
    } catch (e) {}
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (values.type !== 'judge' && (!values.options || values.options.length < 2)) {
        message.error('选择题至少需要2个选项')
        return
      }

      const data = {
        course_id: id,
        question: values.question,
        type: values.type,
        options: values.type === 'judge' ? null : values.options,
        answer: values.answer,
        score: values.score
      }

      if (editingItem) {
        await request.put(`/exams/questions/${editingItem.id}`, data)
        message.success('更新成功')
      } else {
        await request.post('/exams/questions', data)
        message.success('添加成功')
      }
      setModalVisible(false)
      loadData()
    } catch (e) {}
  }

  const typeMap = {
    single: { text: '单选题', color: 'blue' },
    multiple: { text: '多选题', color: 'purple' },
    judge: { text: '判断题', color: 'green' }
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    {
      title: '题目', dataIndex: 'question',
      ellipsis: true,
      render: (t) => <span style={{ maxWidth: 400 }}>{t}</span>
    },
    {
      title: '题型', dataIndex: 'type', width: 100,
      render: t => <Tag color={typeMap[t]?.color}>{typeMap[t]?.text}</Tag>
    },
    { title: '分值', dataIndex: 'score', width: 80 },
    {
      title: '正确答案', dataIndex: 'answer', width: 120,
      render: (t, r) => r.type === 'judge' ? (t === 'true' ? '正确' : '错误') : t
    },
    {
      title: '操作', width: 140,
      render: (_, r) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(r)}>编辑</Button>
          <Popconfirm title="确定删除该试题？" onConfirm={() => handleDelete(r.id)}>
            <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <div className="page-container">
      <div className="page-header">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>返回</Button>
          <h2 className="page-title">试题库管理 - {course?.name || ''}</h2>
        </Space>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>添加试题</Button>
      </div>

      <Card>
        <Table
          loading={loading}
          columns={columns}
          dataSource={data}
          rowKey="id"
          pagination={{ pageSize: 10, showTotal: t => `共 ${t} 题` }}
          expandable={{
            expandedRowRender: (record) => (
              <div style={{ padding: '0 20px' }}>
                {record.options && Array.isArray(record.options) && record.options.map((opt, i) => (
                  <div key={i} style={{ marginBottom: 8 }}>
                    {String.fromCharCode(65 + i)}. {opt}
                  </div>
                ))}
              </div>
            )
          }}
        />
      </Card>

      <Modal
        title={editingItem ? '编辑试题' : '添加试题'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
        width={700}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="type" label="题型" rules={[{ required: true }]}>
            <Radio.Group>
              <Radio value="single">单选题</Radio>
              <Radio value="multiple">多选题</Radio>
              <Radio value="judge">判断题</Radio>
            </Radio.Group>
          </Form.Item>

          <Form.Item name="question" label="题目" rules={[{ required: true, message: '请输入题目' }]}>
            <TextArea rows={3} placeholder="请输入题目内容" />
          </Form.Item>

          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.type !== cur.type}>
            {({ getFieldValue }) => {
              const type = getFieldValue('type')
              if (type === 'judge') {
                return (
                  <Form.Item name="answer" label="正确答案" rules={[{ required: true }]}>
                    <Radio.Group>
                      <Radio value="true">正确</Radio>
                      <Radio value="false">错误</Radio>
                    </Radio.Group>
                  </Form.Item>
                )
              }
              return (
                <>
                  <Form.List name="options">
                    {(fields, { add, remove }) => (
                      <>
                        {fields.map(({ key, name, ...restField }, index) => (
                          <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                            <span style={{ width: 24 }}>{String.fromCharCode(65 + index)}.</span>
                            <Form.Item
                              {...restField}
                              name={[name]}
                              rules={[{ required: true, message: '请输入选项' }]}
                              style={{ marginBottom: 0, flex: 1 }}
                            >
                              <Input placeholder={`选项 ${String.fromCharCode(65 + index)}`} />
                            </Form.Item>
                            {fields.length > 2 && <Button type="text" danger onClick={() => remove(name)}>删除</Button>}
                          </Space>
                        ))}
                        <Button type="dashed" onClick={() => add()} block>
                          + 添加选项
                        </Button>
                      </>
                    )}
                  </Form.List>

                  <Form.Item name="answer" label="正确答案" rules={[{ required: true, message: '请输入正确答案' }]}>
                    <Input placeholder={type === 'multiple' ? '多个答案用逗号分隔，如 A,B,C' : '如 A'} />
                  </Form.Item>
                </>
              )
            }}
          </Form.Item>

          <Form.Item name="score" label="分值" rules={[{ required: true }]}>
            <InputNumber min={5} max={100} step={5} defaultValue={10} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
