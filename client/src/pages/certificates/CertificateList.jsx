import React, { useState, useEffect } from 'react'
import { Table, Tag, Input, Select, Space, Card, Button, Modal, Form, message } from 'antd'
import { DownloadOutlined, PlusOutlined, SearchOutlined, FileTextOutlined } from '@ant-design/icons'
import request from '../../utils/request'

const { Search } = Input
const { Option } = Select

const statusMap = {
  valid: { text: '有效', color: 'green' },
  expired: { text: '过期', color: 'red' }
}

const user = JSON.parse(localStorage.getItem('user') || '{}')

export default function CertificateList() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState([])
  const [departments, setDepartments] = useState([])
  const [exams, setExams] = useState([])
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })
  const [filters, setFilters] = useState({ department: '', keyword: '' })
  const [generateModalVisible, setGenerateModalVisible] = useState(false)
  const [form] = Form.useForm()

  useEffect(() => {
    loadData()
    loadDepartments()
    loadExams()
  }, [pagination.current, pagination.pageSize, filters])

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await request.get('/certificates', {
        params: { ...filters, page: pagination.current, pageSize: pagination.pageSize }
      })
      const list = res.data?.list || []
      const today = new Date()
      const processedList = list.map(item => {
        if (item.expire_date && new Date(item.expire_date) < today) {
          return { ...item, status: 'expired' }
        }
        return { ...item, status: item.status || 'valid' }
      })
      setData(processedList)
      setPagination(p => ({ ...p, total: res.data?.total || 0 }))
    } finally {
      setLoading(false)
    }
  }

  const loadDepartments = async () => {
    try {
      const res = await request.get('/users/departments')
      setDepartments(res.data || [])
    } catch (e) {}
  }

  const loadExams = async () => {
    try {
      const res = await request.get('/exams', { params: { pageSize: 100, page: 1 } })
      setExams(res.data?.list || [])
    } catch (e) {}
  }

  const handleDownload = async (id) => {
    try {
      const link = document.createElement('a')
      link.href = `/api/certificates/download/${id}`
      link.target = '_blank'
      link.download = ''
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      message.success('开始下载')
    } catch (e) {
      message.error('下载失败')
    }
  }

  const handleGenerate = async () => {
    try {
      const values = await form.validateFields()
      await request.post('/certificates/generate', values)
      message.success('证书生成成功')
      setGenerateModalVisible(false)
      form.resetFields()
      loadData()
    } catch (e) {}
  }

  const columns = [
    { title: '证书编号', dataIndex: 'certificate_no', width: 160 },
    { title: '持证人', dataIndex: ['user', 'name'], width: 100 },
    { title: '部门', dataIndex: ['user', 'department'], width: 120 },
    { title: '课程名称', dataIndex: 'course_name', width: 200 },
    { title: '颁发日期', dataIndex: 'issue_date', width: 120 },
    { title: '有效期至', dataIndex: 'expire_date', width: 120, render: t => t || '长期有效' },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: s => <Tag color={statusMap[s]?.color}>{statusMap[s]?.text}</Tag>
    },
    {
      title: '操作',
      width: 200,
      render: (_, r) => (
        <Space>
          <Button
            type="link"
            icon={<DownloadOutlined />}
            onClick={() => handleDownload(r.id)}
          >
            下载PDF
          </Button>
        </Space>
      )
    }
  ]

  return (
    <div className="page-container">
      <div className="page-header">
        <h2 className="page-title">证书管理</h2>
        {user.role === 'trainer' && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setGenerateModalVisible(true)}
          >
            生成证书
          </Button>
        )}
      </div>

      <Card>
        <Space style={{ marginBottom: 16 }} wrap>
          <Search
            placeholder="搜索姓名/证书编号/课程名"
            style={{ width: 280 }}
            allowClear
            onSearch={v => setFilters(f => ({ ...f, keyword: v }))}
          />
          <Select
            placeholder="选择部门"
            style={{ width: 160 }}
            allowClear
            onChange={v => setFilters(f => ({ ...f, department: v }))}
          >
            {departments.map(dept => (
              <Option key={dept} value={dept}>{dept}</Option>
            ))}
          </Select>
          <Button type="primary" icon={<SearchOutlined />} onClick={loadData}>查询</Button>
        </Space>

        <Table
          loading={loading}
          columns={columns}
          dataSource={data}
          rowKey="id"
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: t => `共 ${t} 条`,
            onChange: (p, ps) => setPagination({ ...pagination, current: p, pageSize: ps })
          }}
        />
      </Card>

      <Modal
        title={<span><FileTextOutlined style={{ marginRight: 8 }} />生成证书</span>}
        open={generateModalVisible}
        onCancel={() => {
          setGenerateModalVisible(false)
          form.resetFields()
        }}
        onOk={handleGenerate}
        okText="生成"
        cancelText="取消"
        width={500}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="examId"
            label="选择考试记录"
            rules={[{ required: true, message: '请选择考试记录' }]}
          >
            <Select placeholder="请选择要生成证书的考试记录">
              {exams.filter(e => e.passed).map(exam => (
                <Option key={exam.id} value={exam.id}>
                  {exam.user?.name} - {exam.course?.name} ({exam.score}分)
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="expireDate" label="有效期至">
            <Input type="date" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
