import React, { useState, useEffect } from 'react'
import { Table, Tag, Space, Card, Button, Modal, Form, Input, message, Tabs } from 'antd'
import { CheckOutlined, CloseOutlined, EyeOutlined } from '@ant-design/icons'
import request from '../../utils/request'

const { TextArea } = Input
const { TabPane } = Tabs

const statusMap = {
  pending: { text: '待审批', color: 'orange' },
  approved: { text: '已通过', color: 'blue' },
  rejected: { text: '已拒绝', color: 'red' },
  completed: { text: '已完成', color: 'green' },
  cancelled: { text: '已取消', color: 'default' },
  escalated: { text: '超时升级', color: 'red' }
}

const transformRecord = (r) => ({
  ...r,
  user: {
    name: r.user_name,
    department: r.department,
    position: r.position,
    phone: r.phone,
    email: r.email
  },
  course: {
    name: r.course_name,
    code: r.course_code,
    hours: r.hours,
    category: r.category,
    teacher: r.teacher
  },
  approver: {
    name: r.approver_name
  },
  created_at: r.apply_time,
  approved_at: r.approve_time
})

export default function PendingApprovals() {
  const [activeTab, setActiveTab] = useState('pending')
  const [loading, setLoading] = useState(false)
  const [pendingData, setPendingData] = useState([])
  const [processedData, setProcessedData] = useState([])
  const [pendingPagination, setPendingPagination] = useState({ current: 1, pageSize: 10, total: 0 })
  const [processedPagination, setProcessedPagination] = useState({ current: 1, pageSize: 10, total: 0 })
  const [rejectModalVisible, setRejectModalVisible] = useState(false)
  const [currentRecord, setCurrentRecord] = useState(null)
  const [detailModalVisible, setDetailModalVisible] = useState(false)
  const [form] = Form.useForm()

  useEffect(() => {
    if (activeTab === 'pending') {
      loadPendingData()
    } else {
      loadProcessedData()
    }
  }, [activeTab])

  const loadPendingData = async (page = 1, pageSize = 10) => {
    setLoading(true)
    try {
      const res = await request.get('/enrollments/pending', { params: { page, pageSize } })
      setPendingData((res.data?.list || []).map(transformRecord))
      setPendingPagination(p => ({ ...p, current: page, pageSize, total: res.data?.total || 0 }))
    } finally {
      setLoading(false)
    }
  }

  const loadProcessedData = async (page = 1, pageSize = 10) => {
    setLoading(true)
    try {
      const res = await request.get('/enrollments/processed', { params: { page, pageSize } })
      setProcessedData((res.data?.list || []).map(transformRecord))
      setProcessedPagination(p => ({ ...p, current: page, pageSize, total: res.data?.total || 0 }))
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (record) => {
    try {
      await request.post(`/enrollments/${record.id}/approve`)
      message.success('审批通过')
      loadPendingData(pendingPagination.current, pendingPagination.pageSize)
    } catch (e) {}
  }

  const handleReject = (record) => {
    setCurrentRecord(record)
    setRejectModalVisible(true)
    form.resetFields()
  }

  const handleRejectSubmit = async () => {
    try {
      const values = await form.validateFields()
      await request.post(`/enrollments/${currentRecord.id}/reject`, values)
      message.success('已拒绝')
      setRejectModalVisible(false)
      loadPendingData(pendingPagination.current, pendingPagination.pageSize)
    } catch (e) {}
  }

  const handleViewDetail = (record) => {
    setCurrentRecord(record)
    setDetailModalVisible(true)
  }

  const pendingColumns = [
    { title: '申请人', dataIndex: ['user', 'name'], width: 120 },
    { title: '部门', dataIndex: ['user', 'department'], width: 120 },
    { title: '职位', dataIndex: ['user', 'position'], width: 120 },
    { title: '课程名称', dataIndex: ['course', 'name'], width: 200 },
    { title: '学时', dataIndex: ['course', 'hours'], width: 80 },
    { title: '申请时间', dataIndex: 'created_at', width: 160 },
    {
      title: '状态', dataIndex: 'status', width: 100,
      render: s => <Tag color={statusMap[s]?.color}>{statusMap[s]?.text}</Tag>
    },
    {
      title: '操作', width: 180,
      render: (_, r) => (
        <Space>
          <Button type="link" icon={<EyeOutlined />} onClick={() => handleViewDetail(r)}>详情</Button>
          <Button type="link" icon={<CheckOutlined />} onClick={() => handleApprove(r)}>通过</Button>
          <Button type="link" danger icon={<CloseOutlined />} onClick={() => handleReject(r)}>拒绝</Button>
        </Space>
      )
    }
  ]

  const processedColumns = [
    { title: '申请人', dataIndex: ['user', 'name'], width: 120 },
    { title: '部门', dataIndex: ['user', 'department'], width: 120 },
    { title: '职位', dataIndex: ['user', 'position'], width: 120 },
    { title: '课程名称', dataIndex: ['course', 'name'], width: 200 },
    { title: '学时', dataIndex: ['course', 'hours'], width: 80 },
    { title: '申请时间', dataIndex: 'created_at', width: 160 },
    {
      title: '状态', dataIndex: 'status', width: 100,
      render: s => <Tag color={statusMap[s]?.color}>{statusMap[s]?.text}</Tag>
    },
    { title: '审批人', dataIndex: ['approver', 'name'], width: 120 },
    { title: '审批时间', dataIndex: 'approved_at', width: 160 },
    {
      title: '操作', width: 100,
      render: (_, r) => (
        <Button type="link" icon={<EyeOutlined />} onClick={() => handleViewDetail(r)}>详情</Button>
      )
    }
  ]

  return (
    <div className="page-container">
      <div className="page-header">
        <h2 className="page-title">待审批报名</h2>
      </div>

      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab="待处理" key="pending">
            <Table
              loading={loading}
              columns={pendingColumns}
              dataSource={pendingData}
              rowKey="id"
              pagination={{
                ...pendingPagination,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: t => `共 ${t} 条`,
                onChange: (p, ps) => loadPendingData(p, ps)
              }}
            />
          </TabPane>
          <TabPane tab="已处理" key="processed">
            <Table
              loading={loading}
              columns={processedColumns}
              dataSource={processedData}
              rowKey="id"
              pagination={{
                ...processedPagination,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: t => `共 ${t} 条`,
                onChange: (p, ps) => loadProcessedData(p, ps)
              }}
            />
          </TabPane>
        </Tabs>
      </Card>

      <Modal
        title="拒绝申请"
        open={rejectModalVisible}
        onCancel={() => setRejectModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setRejectModalVisible(false)}>取消</Button>,
          <Button key="submit" type="primary" danger onClick={handleRejectSubmit}>确认拒绝</Button>
        ]}
        width={500}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="reject_reason"
            label="拒绝原因"
            rules={[{ required: true, message: '请输入拒绝原因' }]}
          >
            <TextArea rows={4} placeholder="请输入拒绝原因" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="报名详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>关闭</Button>
        ]}
        width={600}
      >
        {currentRecord && (
          <div className="detail-content">
            <p><strong>申请人：</strong>{currentRecord.user?.name}</p>
            <p><strong>部门：</strong>{currentRecord.user?.department}</p>
            <p><strong>职位：</strong>{currentRecord.user?.position}</p>
            <p><strong>联系电话：</strong>{currentRecord.user?.phone}</p>
            <p><strong>邮箱：</strong>{currentRecord.user?.email}</p>
            <p><strong>课程名称：</strong>{currentRecord.course?.name}</p>
            <p><strong>课程编码：</strong>{currentRecord.course?.code}</p>
            <p><strong>学时：</strong>{currentRecord.course?.hours}学时</p>
            <p><strong>分类：</strong>{currentRecord.course?.category}</p>
            <p><strong>讲师：</strong>{currentRecord.course?.teacher}</p>
            <p><strong>申请时间：</strong>{currentRecord.created_at}</p>
            <p><strong>状态：</strong>
              <Tag color={statusMap[currentRecord.status]?.color}>
                {statusMap[currentRecord.status]?.text}
              </Tag>
            </p>
            {currentRecord.approver?.name && (
              <p><strong>审批人：</strong>{currentRecord.approver?.name}</p>
            )}
            {currentRecord.approved_at && (
              <p><strong>审批时间：</strong>{currentRecord.approved_at}</p>
            )}
            {currentRecord.reject_reason && (
              <p><strong>拒绝原因：</strong>{currentRecord.reject_reason}</p>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
