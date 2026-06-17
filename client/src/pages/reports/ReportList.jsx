import React, { useState, useEffect } from 'react'
import { Table, Tag, Select, Space, Card, Button, Modal, Form, message, Descriptions } from 'antd'
import { DownloadOutlined, PlusOutlined, SearchOutlined, EyeOutlined, FileTextOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import request from '../../utils/request'

const { Option } = Select

export default function ReportList() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState([])
  const [departments, setDepartments] = useState([])
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 })
  const [filters, setFilters] = useState({ month: '', department: '' })
  const [generateModalVisible, setGenerateModalVisible] = useState(false)
  const [detailModalVisible, setDetailModalVisible] = useState(false)
  const [currentReport, setCurrentReport] = useState(null)
  const [form] = Form.useForm()

  const months = []
  for (let i = 0; i < 24; i++) {
    const date = dayjs().subtract(i, 'month')
    months.push({
      value: date.format('YYYY-MM'),
      label: date.format('YYYY年MM月')
    })
  }

  useEffect(() => {
    loadData()
    loadDepartments()
  }, [pagination.current, pagination.pageSize, filters])

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await request.get('/reports', {
        params: { ...filters, page: pagination.current, pageSize: pagination.pageSize }
      })
      setData(res.data?.list || [])
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

  const handleDownload = async (id) => {
    try {
      const link = document.createElement('a')
      link.href = `/api/reports/download/${id}`
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

  const handleViewDetail = (record) => {
    setCurrentReport(record)
    setDetailModalVisible(true)
  }

  const handleGenerate = async () => {
    try {
      const values = await form.validateFields()
      const res = await request.post('/reports/generate', values)
      message.success('报告生成成功')
      setGenerateModalVisible(false)
      form.resetFields()
      loadData()
    } catch (e) {}
  }

  const columns = [
    { title: '报告月份', dataIndex: 'month', width: 120 },
    { title: '部门', dataIndex: 'department', width: 120 },
    {
      title: '培训完成率',
      dataIndex: 'completion_rate',
      width: 120,
      render: v => `${v || 0}%`
    },
    {
      title: '考试合格率',
      dataIndex: 'pass_rate',
      width: 120,
      render: v => `${v || 0}%`
    },
    { title: '证书发放量', dataIndex: 'certificate_count', width: 120 },
    { title: '生成时间', dataIndex: 'created_at', width: 160 },
    {
      title: '操作',
      width: 200,
      render: (_, r) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(r)}
          >
            查看详情
          </Button>
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
        <h2 className="page-title">月度报告</h2>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setGenerateModalVisible(true)}
        >
          生成报告
        </Button>
      </div>

      <Card>
        <Space style={{ marginBottom: 16 }} wrap>
          <Select
            placeholder="选择月份"
            style={{ width: 160 }}
            allowClear
            onChange={v => setFilters(f => ({ ...f, month: v }))}
          >
            {months.map(m => (
              <Option key={m.value} value={m.value}>{m.label}</Option>
            ))}
          </Select>
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
        title={<span><FileTextOutlined style={{ marginRight: 8 }} />生成月度报告</span>}
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
            name="month"
            label="报告月份"
            rules={[{ required: true, message: '请选择报告月份' }]}
          >
            <Select placeholder="请选择报告月份">
              {months.map(m => (
                <Option key={m.value} value={m.value}>{m.label}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="department"
            label="部门"
            rules={[{ required: true, message: '请选择部门' }]}
          >
            <Select placeholder="请选择部门">
              {departments.map(dept => (
                <Option key={dept} value={dept}>{dept}</Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={<span><FileTextOutlined style={{ marginRight: 8 }} />报告详情</span>}
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>关闭</Button>
        ]}
        width={700}
      >
        {currentReport && (
          <div>
            <Descriptions bordered column={2} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="报告月份">{currentReport.month}</Descriptions.Item>
              <Descriptions.Item label="部门">{currentReport.department}</Descriptions.Item>
              <Descriptions.Item label="培训完成率">{currentReport.completion_rate || 0}%</Descriptions.Item>
              <Descriptions.Item label="考试合格率">{currentReport.pass_rate || 0}%</Descriptions.Item>
              <Descriptions.Item label="培训人次">{currentReport.training_count || 0}</Descriptions.Item>
              <Descriptions.Item label="考试人次">{currentReport.exam_count || 0}</Descriptions.Item>
              <Descriptions.Item label="证书发放量">{currentReport.certificate_count || 0}</Descriptions.Item>
              <Descriptions.Item label="生成时间">{currentReport.created_at}</Descriptions.Item>
            </Descriptions>
            <Card title="培训明细" size="small">
              <Table
                dataSource={currentReport.details || []}
                rowKey="id"
                pagination={false}
                size="small"
              >
                <Table.Column title="课程名称" dataIndex="course_name" />
                <Table.Column title="参训人数" dataIndex="enrolled_count" />
                <Table.Column title="完成人数" dataIndex="completed_count" />
                <Table.Column title="完成率" dataIndex="completion_rate" render={v => `${v || 0}%`} />
              </Table>
            </Card>
          </div>
        )}
      </Modal>
    </div>
  )
}
